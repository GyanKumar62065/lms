import { randomUUID } from 'crypto';
import mongoose, { Types } from 'mongoose';
import { BorrowerProfile } from '../../models/borrower-profile.model';
import { Loan } from '../../models/loan.model';
import { Payment } from '../../models/payment.model';
import { evaluateBre, EmploymentMode } from '../../lib/bre';
import { rupeesToPaise, paiseToRupees } from '../../lib/money';
import { computeRepayment } from '../../lib/loan-math';
import { generateLoanRef } from '../../lib/loan-ref';
import { ValidationError, NotFoundError, ConflictError, ProductNotFoundError, ProductBoundsError, ProductEligibilityError } from '../../lib/errors';
import { LoanProduct } from '../../models/loan-product.model';
import { ProfileInput } from './borrower.dto';
import { getUploadUrl, getDownloadUrl } from '../../lib/storage';
import { cancel as cancelLoan } from '../loans/loans.service';

export async function upsertProfile(userId: string, input: ProfileInput) {
  const monthlySalaryPaise = rupeesToPaise(input.monthlySalary);
  const result = evaluateBre({
    pan: input.pan,
    dob: input.dob,
    monthlySalaryPaise,
    employmentMode: input.employmentMode,
  });
  const profile = await BorrowerProfile.findOneAndUpdate(
    { user: new Types.ObjectId(userId) },
    {
      $set: {
        user: new Types.ObjectId(userId),
        pan: input.pan,
        dob: input.dob,
        monthlySalary: monthlySalaryPaise,
        employmentMode: input.employmentMode,
        eligibility: { passed: result.passed, evaluatedAt: new Date(), failedRules: result.failedRules },
      },
    },
    { upsert: true, new: true },
  );
  if (!result.passed) {
    throw new ValidationError('Eligibility check failed', { failedRules: result.failedRules });
  }
  return profile;
}

export async function getProfile(userId: string) {
  const profile = await BorrowerProfile.findOne({ user: new Types.ObjectId(userId) });
  if (!profile) throw new NotFoundError('Profile not found');
  return profile;
}

export async function presignSlip(userId: string, input: { filename: string; mime: string; size: number }) {
  const ext = input.filename.split('.').pop() ?? 'bin';
  // bucket already namespaces these; key is per-user to avoid cross-user overwrite
  const objectKey = `${userId}/${randomUUID()}.${ext}`;
  const uploadUrl = await getUploadUrl(objectKey, input.mime);
  return { uploadUrl, objectKey };
}

export async function stageSlip(
  userId: string,
  file: { objectKey: string; filename: string; mime: string; size: number },
) {
  const profile = await BorrowerProfile.findOneAndUpdate(
    { user: new Types.ObjectId(userId) },
    { $set: { pendingSalarySlip: file } },
    { new: true },
  );
  if (!profile) throw new NotFoundError('Complete personal details first');
  return profile;
}

export async function applyForLoan(
  userId: string,
  input: { productCode: string; principal: number; tenureDays: number },
) {
  const principal = rupeesToPaise(input.principal);

  const session = await mongoose.startSession();
  try {
    let createdLoan: any;
    await session.withTransaction(async () => {
      // 1. product must exist and be ACTIVE
      const product = await LoanProduct.findOne({ code: input.productCode, status: 'ACTIVE' }).session(session);
      if (!product) throw new ProductNotFoundError();

      // 2. bounds (paise) against the product
      if (principal < product.minPrincipal || principal > product.maxPrincipal) {
        throw new ProductBoundsError('Principal is outside the product range', {
          minPrincipal: paiseToRupees(product.minPrincipal),
          maxPrincipal: paiseToRupees(product.maxPrincipal),
          minTenureDays: product.minTenureDays,
          maxTenureDays: product.maxTenureDays,
        });
      }
      if (input.tenureDays < product.minTenureDays || input.tenureDays > product.maxTenureDays) {
        throw new ProductBoundsError('Tenure is outside the product range', {
          minPrincipal: paiseToRupees(product.minPrincipal),
          maxPrincipal: paiseToRupees(product.maxPrincipal),
          minTenureDays: product.minTenureDays,
          maxTenureDays: product.maxTenureDays,
        });
      }

      // 3. profile + staged slip
      const profile = await BorrowerProfile.findOne({ user: new Types.ObjectId(userId) }).session(session);
      if (!profile) throw new ConflictError('Complete your profile first');
      if (!profile.pendingSalarySlip) throw new ConflictError('Salary slip not uploaded');

      // 4. product-specific eligibility
      const bre = evaluateBre(
        {
          pan: profile.pan,
          dob: profile.dob,
          monthlySalaryPaise: profile.monthlySalary,
          employmentMode: profile.employmentMode as EmploymentMode,
        },
        {
          minAge: product.eligibility.minAge,
          maxAge: product.eligibility.maxAge,
          minMonthlySalaryPaise: product.eligibility.minMonthlySalary,
          employmentModes: product.eligibility.employmentModes as EmploymentMode[],
        },
      );
      if (!bre.passed) throw new ProductEligibilityError(bre.failedRules);

      // 5. per-product one-active guard
      const active = await Loan.findOne(
        { borrower: new Types.ObjectId(userId), product: product._id, status: { $in: ['APPLIED', 'SANCTIONED', 'DISBURSED'] } },
        null,
        { session },
      );
      if (active) {
        throw new ConflictError('You already have an active application for this product', {
          loanRef: active.loanRef,
          productCode: product.code,
        });
      }

      // 6. compute with the product rate + snapshot terms
      const { simpleInterest, totalRepayment } = computeRepayment(principal, input.tenureDays, product.interestRate);
      const loanRef = await generateLoanRef(session);
      const [loan] = await Loan.create(
        [
          {
            loanRef,
            borrower: new Types.ObjectId(userId),
            product: product._id,
            productCode: product.code,
            productName: product.name,
            principal,
            tenureDays: input.tenureDays,
            interestRate: product.interestRate,
            simpleInterest,
            totalRepayment,
            amountPaid: 0,
            outstanding: totalRepayment,
            status: 'APPLIED',
            salarySlip: profile.pendingSalarySlip,
            statusHistory: [{ from: null, to: 'APPLIED', by: new Types.ObjectId(userId), at: new Date() }],
          },
        ],
        { session },
      );
      // 7. clear the staged slip
      await BorrowerProfile.updateOne({ _id: profile._id }, { $unset: { pendingSalarySlip: '' } }, { session });
      createdLoan = loan;
    });
    return createdLoan;
  } finally {
    await session.endSession();
  }
}

export async function listOwnLoans(userId: string) {
  const data = await Loan.find({ borrower: new Types.ObjectId(userId) }).sort({ createdAt: -1 });
  return { data, pagination: { page: 1, limit: data.length, total: data.length } };
}

export async function getOwnLoan(userId: string, loanId: string) {
  const loan = await Loan.findOne({ _id: loanId, borrower: new Types.ObjectId(userId) });
  if (!loan) throw new NotFoundError('Loan not found');
  const paymentDocs = await Payment.find({ loan: loan._id }).sort({ paidAt: 1 });
  const payments = paymentDocs.map((p) => ({
    _id: p._id.toString(),
    utr: p.utr,
    amount: paiseToRupees(p.amount as number), // rupees
    paidAt: p.paidAt,
  }));
  return { loan, payments };
}

export async function cancelOwnLoan(userId: string, loanId: string, reason?: string) {
  const owned = await Loan.findOne({ _id: loanId, borrower: new Types.ObjectId(userId) });
  if (!owned) throw new NotFoundError('Loan not found'); // ownership check = existence (no leak)
  return cancelLoan(loanId, userId, reason); // throws ConflictError 409 if illegal state
}

export async function getOwnLoanDocument(userId: string, loanId: string) {
  const loan = await Loan.findOne({ _id: loanId, borrower: new Types.ObjectId(userId) });
  if (!loan || !loan.salarySlip?.objectKey) throw new NotFoundError('Document not found');
  const url = await getDownloadUrl(loan.salarySlip.objectKey);
  return { url, filename: loan.salarySlip.filename, mime: loan.salarySlip.mime };
}
