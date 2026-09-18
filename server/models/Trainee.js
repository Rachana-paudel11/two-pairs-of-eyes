import mongoose from 'mongoose';

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
    role: {
      type: String,
      default: 'Safety Inspector Trainee'
    },
    department: {
      type: String,
      default: 'Warehouse Logistics & Health Safety'
    },
    patrolsCompleted: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

export const Trainee = mongoose.model('Trainee', traineeSchema);
