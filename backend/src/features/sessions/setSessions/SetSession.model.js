import mongoose from "mongoose";

const setSessionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },

    workoutSession: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WorkoutSession',
        required: true,
    },

    exerciseSession: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ExerciseSession',
        required: true,
    },

    order: {
        type: Number,
        required: true,
        min: 1,
        validate: {
            validator: Number.isInteger,
            message: 'Set order must be a whole number.'
        }
    },

    status: {
        type: String,
        enum: ['not-started', 'in-progress', 'completed', 'skipped'],
        default: 'not-started',
        required: true,
    },

    restAfterMs: {
        type: Number,
        min: 0,
        default: null,
    },

    weightKg: {
        type: Number,
        min: 0,
        default: null,
    },

    reps: {
        type: Number,
        min: 1,
        validate: {
            validator: value => value === null || Number.isInteger(value),
            message: 'Reps must be a whole number.',
        },
        default: null,
    },

    startedAt: {
        type: Date,
        default: null,
    },

    completedAt: {
        type: Date,
        default: null,
    },

    skippedAt: {
        type: Date,
        default: null,
    }
},
    {
        timestamps: true,
    }
);

setSessionSchema.index(
    { exerciseSession: 1, order: 1, },
    { unique: true, },
);

setSessionSchema.index(
    { user: 1 },
    {
        unique: true,
        partialFilterExpression: {
            status: 'in-progress',
        }
    }
);

const SetSession = mongoose.model('SetSession', setSessionSchema);

export default SetSession;
