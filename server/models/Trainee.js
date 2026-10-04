import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const VALID_ROLES = [
  'trainee',
  'trainer',
  'admin',
  'TRAINEE',
  'TRAINER',
  'ADMIN',
  'Safety Inspector Trainee',
  'Supervisor',
  'Administrator'
];

const traineeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      default: 'Alex',
      trim: true,
      maxlength: 80
    },
    traineeId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      maxlength: 50
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: VALID_ROLES,
      default: 'trainee'
    },
    department: {
      type: String,
      default: 'Warehouse Logistics & Health Safety',
      trim: true,
      maxlength: 100
    },
    patrolsCompleted: {
      type: Number,
      default: 0,
      min: 0
    },
    failedLoginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      }
    },
    toObject: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      }
    }
  }
);

traineeSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

traineeSchema.methods.comparePassword = async function (candidatePassword) {
  if (!candidatePassword || !this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

export const Trainee = mongoose.model('Trainee', traineeSchema);
