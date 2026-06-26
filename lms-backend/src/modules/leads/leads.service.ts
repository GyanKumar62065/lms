import { Types } from 'mongoose';
import { User } from '../../models/user.model';
import { Role } from '../../models/role.model';
import { BorrowerProfile } from '../../models/borrower-profile.model';
import { Loan } from '../../models/loan.model';
import { NotFoundError } from '../../lib/errors';

export type LeadStage = 'REGISTERED' | 'DETAILS_SUBMITTED' | 'BRE_REJECTED' | 'SLIP_UPLOADED' | 'APPLIED';

export function deriveStage(
  profile: { eligibility?: { passed: boolean } | null; pendingSalarySlip?: unknown } | null,
  isApplied = false,
): LeadStage {
  if (isApplied) return 'APPLIED';
  if (!profile) return 'REGISTERED';
  if (profile.eligibility && !profile.eligibility.passed) return 'BRE_REJECTED';
  if (profile.pendingSalarySlip) return 'SLIP_UPLOADED';
  return 'DETAILS_SUBMITTED';
}

export async function listLeads({
  page = 1,
  limit = 20,
  stage,
}: { page?: number; limit?: number; stage?: LeadStage } = {}) {
  const borrowerRole = await Role.findOne({ code: 'BORROWER' });
  if (!borrowerRole) throw new Error('BORROWER role missing');
  const borrowers = await User.find({ role: borrowerRole._id }).sort({ createdAt: -1 });

  // Borrowers who have any loan in a converted status → stage APPLIED
  const appliedIds = new Set(
    (
      await Loan.find({ status: { $in: ['APPLIED', 'SANCTIONED', 'DISBURSED', 'CLOSED'] } }).distinct('borrower')
    ).map((id: any) => id.toString()),
  );

  // Fetch all profiles for all borrowers upfront (needed for stage derivation before filtering)
  const allUserIds = borrowers.map((u) => u._id);
  const profiles = await BorrowerProfile.find({ user: { $in: allUserIds } });
  const profileByUserId = new Map(profiles.map((p) => [p.user.toString(), p]));

  // Derive stage for every borrower
  const allLeads = borrowers.map((u) => {
    const profile = profileByUserId.get(u._id.toString()) ?? null;
    const isApplied = appliedIds.has(u._id.toString());
    return {
      userId: u._id,
      fullName: u.fullName,
      email: u.email,
      // `timestamps: true` adds createdAt at runtime, but Mongoose's InferSchemaType doesn't surface it in the type
      registeredAt: (u as unknown as { createdAt: Date }).createdAt,
      stage: deriveStage(profile, isApplied),
      eligibility: profile?.eligibility ?? null,
      monthlySalary: profile?.monthlySalary ?? null,
      employmentMode: profile?.employmentMode ?? null,
      contacted: profile?.contacted ?? null,
    };
  });

  // Apply optional stage filter
  const filtered = stage ? allLeads.filter((l) => l.stage === stage) : allLeads;
  const total = filtered.length;
  const start = (page - 1) * limit;
  const data = filtered.slice(start, start + limit);

  return { data, pagination: { page, limit, total } };
}

export async function getLead(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('Lead not found');
  const profile = await BorrowerProfile.findOne({ user: user._id });
  return { userId: user._id, fullName: user.fullName, email: user.email, stage: deriveStage(profile), profile };
}

export async function markContacted(userId: string, by: string, note?: string) {
  const profile = await BorrowerProfile.findOneAndUpdate(
    { user: new Types.ObjectId(userId) },
    { $set: { contacted: { flag: true, note, by: new Types.ObjectId(by), at: new Date() } } },
    { new: true },
  );
  if (!profile) throw new NotFoundError('Profile not found for lead');
  return profile.contacted;
}
