import mongoose from 'mongoose';

const positionSchema = new mongoose.Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    z: { type: Number, required: true }
  },
  { _id: false }
);

const actionSchema = new mongoose.Schema(
  {
    interaction: { type: String, required: true },
    points: { type: Number, required: true, min: -10, max: 10 },
    outcome: {
      type: String,
      enum: ['optimal', 'partial', 'neutral', 'failure'],
      required: true
    },
    consequence: { type: String, required: true },
    feedback: { type: String, required: true },
    alexAction: { type: String }
  },
  { _id: false }
);

const hazardSchema = new mongoose.Schema(
  {
    present: { type: Boolean, required: true },
    type: { type: String },
    subtype: { type: String },
    severity: {
      type: String,
      enum: ['low', 'moderate', 'severe']
    }
  },
  { _id: false }
);

const supervisorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    behaviour: {
      type: String,
      enum: ['dismissive', 'correct', 'uncertain'],
      required: true
    },
    dialogue: { type: String, required: true }
  },
  { _id: false }
);

const scenarioStopSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: /^[a-z0-9_]+$/
    },
    order: { type: Number, default: 0 },
    title: { type: String, required: true, minlength: 1 },
    location: { type: String, required: true, minlength: 1 },
    hazard: { type: hazardSchema, required: true },
    supervisor: { type: supervisorSchema, required: true },
    alexStartPosition: { type: positionSchema },
    alexTargetPosition: { type: positionSchema },
    actions: {
      type: Map,
      of: actionSchema,
      required: true
    },
    flags_on_failure: [{ type: String }],
    learning_objective: { type: String, required: true, minlength: 1 },
    isPublished: { type: Boolean, default: true }
  },
  { timestamps: true }
);

const sessionRuleSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    requiresFlags: [{ type: String, required: true }],
    consequence: { type: String, required: true },
    feedback: { type: String, required: true }
  },
  { timestamps: true }
);

export const Scenario = mongoose.model('Scenario', scenarioStopSchema);
export const SessionRule = mongoose.model('SessionRule', sessionRuleSchema);
