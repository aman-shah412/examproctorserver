const mongoose = require('mongoose');

const objectSchema = new mongoose.Schema({
    studentName: { type: String },
    studentEmail: { type: String },
    studentInfo: { type: String },
    skipRequirment: { type: String },
    status: { type: String },
    studentSessionId: { type: String },
    startTime: { type: String },
    endTime: { type: String },
    incidents: { type: Array },
    finalComment: { type: String },
    flagColor: { type: String },
    reviewStatus: { type: String },
});

const candidateSchema = new mongoose.Schema({
    Streams: {
        type: Object,
    },
    Title: {
        type: String,
    },
    ExamName: {
        type: String,
    },
    FirstStartTime: {
        type: String,
    },
    LastStartTime: {
        type: String,
    },
    Duration: {
        type: String,
    },
    CreationDate: {
        type: String,
    },
    AdminSessionId: {
        type: String,
    },
    DurationCheckbox: {
        type: String,
    },
    MobileCheckbox: {
        type: String,
    },
    UploadCheckbox: {
        type: String,
    },
    GlobalCheckbox: {
        type: String,
    },
    Internet: {
        type: String,
    },
    Application: {
        type: String,
    },
    Textbook: {
        type: String,
    },
    Calculator: {
        type: String,
    },
    PenPaper: {
        type: String,
    },
    Additional: {
        type: String,
    },
    ProctorInstructions: {
        type: String,
    },
    StudentInstructions: {
        type: String,
    },
    Students: {
        type: [objectSchema]
    }
})

const Candidate = mongoose.model("CANDIDATE", candidateSchema)

module.exports = Candidate;