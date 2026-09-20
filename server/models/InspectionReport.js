import mongoose from 'mongoose';

const zoneLogSchema = new mongoose.Schema(
  {
    stopId: { type: String, required: true },
    zoneName: { type: String },
    actionId: { type: String, required: true },
    delta: { type: Number, required: true },
    tier: {
      type: String,
      enum: ['optimal', 'partial', 'neutral', 'failure'],
      required: true
    }
  },
  { _id: false }
);

const inspectionReportSchema = new mongoose.Schema(
  {
    traineeName: {
      type: String,
      default: 'Alex'
    },
    traineeId: {
      type: String,
      default: 'TR-ALEX-01'
    },
    totalScore: {
      type: Number,
      required: true
    },
    maxScore: {
      type: Number,
      default: 25
    },
    passMark: {
      type: Number,
      default: 18
    },
    passed: {
      type: Boolean,
      required: true
    },
    rankTitle: {
      type: String,
      required: true
    },
    rankSubtitle: {
      type: String
    },
    tierCounts: {
      optimal: { type: Number, default: 0 },
      partial: { type: Number, default: 0 },
      neutral: { type: Number, default: 0 },
      failure: { type: Number, default: 0 }
    },
    zoneLogs: [zoneLogSchema],
    flags: [{ type: String }],
    triggeredRules: [{ type: String }],
    supervisorReaction: { type: String },
    completedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

export const InspectionReport = mongoose.model('InspectionReport', inspectionReportSchema);
