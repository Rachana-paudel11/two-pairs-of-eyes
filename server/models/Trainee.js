import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const traineeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      default: 'Alex'
    },
    traineeId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ['trainee', 'trainer'],
      default: 'trainee'
    },
    department: {
      type: String,
      default: 'Warehouse Logistics & Health Safety'
    },
    patrolsCompleted: {
      type: Number,
      default: 0
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
    timestamps: true
  }
);

traineeSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

traineeSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export const Trainee = mongoose.model('Trainee', traineeSchema);
