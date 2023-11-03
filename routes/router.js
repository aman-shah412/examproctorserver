require("dotenv").config();
const express = require("express");
const router = new express.Router();
const mongoose = require('mongoose');
const Candidate = require("../DB/CandidateDB")
const bodyParser = require('body-parser');
const Record = require("../DB/RecordingDB")
const fs = require("fs")
const multer = require("multer")
const upload = multer()
const path = require('path');
const schedule = require('node-schedule');
const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const ffmpeg = require("fluent-ffmpeg")
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffprobePath = require("@ffprobe-installer/ffprobe").path;

ffmpeg.setFfmpegPath(ffmpegPath)
ffmpeg.setFfprobePath(ffprobePath)

const s3client = new S3Client({
    region: "ap-south-1",
    credentials: {
        accessKeyId: process.env.ACCESS_KEY,
        secretAccessKey: process.env.SECRET_KEY
    }
})

mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log("connected");
}).catch((err) => {
    console.log(err);
})

let webscheduler = null
let screenscheduler = null

router.post("/register", (req, res) => {
    let result1 = req.body[0]
    let result2 = req.body[1]
    let result3 = req.body[2]
    let result4 = req.body[3]
    let result5 = req.body[4]
    const connect = new Candidate({
        Streams: result1.streams,
        Title: result1.title,
        ExamName: result1.examName,
        FirstStartTime: result1.firstStartTime,
        LastStartTime: result1.lastStartTime,
        Duration: result1.duration,
        CreationDate: result1.creationDate,
        AdminSessionId: result1.adminSessionId,
        DurationCheckbox: result2.durationCheckbox,
        MobileCheckbox: result2.mobileCheckbox,
        UploadCheckbox: result2.uploadCheckbox,
        GlobalCheckbox: result2.globalCheckbox,
        Internet: result3.internet,
        Application: result3.application,
        Textbook: result3.textbook,
        Calculator: result3.calculator,
        PenPaper: result3.penPaper,
        Additional: result3.additional,
        ProctorInstructions: result4.proctorInstruction,
        StudentInstructions: result5.studentInstruction,
        Students: []
    })
    connect.save().then(savedDocument => {
    })
        .catch(err => {
            console.error(err);
        });

})

router.post("/addstudent/:id", async (req, res) => {
    const id = req.params.id
    let { studentInfo } = req.body

    const add = async (AdminSessionId, data) => {
        try {
            const resp = await Candidate.updateOne({
                AdminSessionId
            }, {
                $push: {
                    Students: data,
                }
            })
            res.send({ data: "Student added successfully" })

        } catch (error) {
            console.log(error);
        }
    }

    const fetch = await Candidate.findOne({ AdminSessionId: id })
    if (fetch.Students.length === 0) {
        add(id, studentInfo)
    } else {
        let students = fetch.Students.map((e) => {
            return e.studentEmail
        })
        if (students.includes(studentInfo.studentEmail)) {
            res.send({ data: "Student already exist" })
        } else {
            add(id, studentInfo)
        }
    }

})

router.post("/savechanges/:id", (req, res) => {
    const id = req.params.id
    let { studentInfoArray } = req.body

    const update = async (AdminSessionId, data) => {
        try {
            const resp = await Candidate.updateOne({
                AdminSessionId
            }, {
                $set: {
                    Students: data,
                }
            })
            res.send({ data: "Changes made successfully" })

        } catch (error) {
            console.log(error);
        }
    }

    update(id, studentInfoArray)
})

router.get("/sendemail/:id", async (req, res) => {
    const id = req.params.id

    const update = async (AdminSessionId, studentId) => {
        try {
            const resp = await Candidate.updateOne({
                AdminSessionId,
                Students: {
                    $elemMatch: {
                        studentSessionId: studentId
                    }
                }
            }, {
                $set: {
                    "Students.$.status": "Email Sent",
                }
            })
        } catch (error) {
            console.log(error);
        }
    }


    let resp = await Candidate.findOne({ AdminSessionId: id })
    resp.Students.map((e) => {
        if (e.status === "Registered") {
            update(id, e.studentSessionId)
        }
    })
    res.send({ data: "Email sent successfully" })
})

router.post("/updateexamdetails/:id", (req, res) => {
    const id = req.params.id
    let { individualExam } = req.body

    const update = async (AdminSessionId, data) => {
        try {
            const resp = await Candidate.updateOne({
                AdminSessionId
            }, {
                $set: {
                    Streams: data.streams,
                    Duration: data.duration,
                    DurationCheckbox: data.durationCheckbox,
                    ExamName: data.examName,
                    FirstStartTime: data.firstStartTime,
                    GlobalCheckbox: data.globalCheckbox,
                    LastStartTime: data.lastStartTime,
                    MobileCheckbox: data.mobileCheckbox,
                    UploadCheckbox: data.uploadCheckbox,
                }
            })
            res.send({ data: "Changes has been saved" })

        } catch (error) {
            res.send({ data: "Something went wrong" })
        }
    }

    update(id, individualExam)
})

let tabData
router.post("/tabprompting", (req, res) => {
    let result = req.body
    tabData = result
})

router.get("/tabprompting", (req, res) => {
    res.send({ status: "OK", data: { numb: 1, text: 'Proceed' } })
})

router.post("/uploadphoto", async (req, res) => {
    let result = req.body
    const connect = new Record({
        RandomID: result.RandomID,
        SelfiePhoto: result.SelfiePhoto,
        IDPhoto: result.IDPhoto,
        AdminSessionId: result.AdminSessionId,
        StudentSessionId: result.StudentSessionId
    })
    connect.save().then(savedDocument => {
        let doc = savedDocument
    })
        .catch(err => {
            console.error(err);
        });
})

router.post("/updatephoto", (req, res) => {
    let result = req.body
    const update = async (randomID) => {
        try {
            const res = await Record.updateOne({ RandomID: randomID }, {
                $set: {
                    SelfiePhoto: result.SelfiePhoto
                }
            })
        } catch (error) {
            console.log(error);
        }
    }
    update(result.RandomID)
})


router.post("/webcamvideo", upload.single("chunk"), async (req, res) => {
    let result = req.file
    let resultBody = req.body
    const folderPath = path.join(__dirname, `../${resultBody.id}`);
    const webcamFolderPath = path.join(__dirname, `../${resultBody.id}/webcam`);

    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
    }
    if (!fs.existsSync(webcamFolderPath)) {
        fs.mkdirSync(webcamFolderPath);
    }

    function mergeWebVideo() {
        fs.readdir(webcamFolderPath, (err, files) => {
            if (err) {
                console.error('Error reading folder:', err);
                return res.status(500).send('Error reading folder.');
            } else {
                const videoFiles = files.filter(file => path.extname(file) === '.webm');

                const inputFiles = videoFiles.map(file => path.join(webcamFolderPath, file));

                const outputFilePath = path.join(webcamFolderPath, `${result.originalname}${resultBody.recordnumber + 100}.webm`);

                const ffmpegCommand = ffmpeg()

                inputFiles.forEach((inputFile) => {
                    ffmpegCommand.input(inputFile)
                });

                ffmpegCommand
                    .on('error', function (err) {
                        console.log('Error ' + err.message);
                    })
                    .on('end', function () {
                        inputFiles.forEach((inputFile) => {
                            fs.unlink(inputFile, (err) => {
                                if (err) {
                                    console.error(err);
                                }
                            });
                        });
                    })
                    .mergeToFile(outputFilePath);
            }
        });
    }

    const updateStudent = async (studentID, date) => {
        try {
            const candidate = await Candidate.findOne({
                "Students._id": studentID
            });
            console.log(candidate);
            const resp = await Candidate.updateOne({
                _id: candidate._id,
                Students: {
                    $elemMatch: {
                        _id: studentID
                    }
                }
            }, {
                $set: {
                    "Students.$.reviewStatus": "Not Reviewed",
                    "Students.$.status": "Exam submitted",
                    "Students.$.endTime": date

                }
            })
            console.log(resp);
        } catch (error) {
            console.log(error);
        }
    }

    const webcamfilePath = path.join(__dirname, `../${resultBody.id}/webcam/${result.originalname}${resultBody.recordnumber}.webm`)

    fs.writeFile(webcamfilePath, result.buffer, err => {
        if (err) {
            console.error('Error saving file:', err);
        } else {
            res.status(200).send('Data processed successfully');
            if (resultBody.refreshed === "true") {
                webscheduler = schedule.scheduleJob(resultBody.timer, () => {
                    mergeWebVideo()
                    console.log(resultBody.date);
                    updateStudent(resultBody.id, resultBody.date)
                })
            } else if (resultBody.refreshed === "null") {
                mergeWebVideo()
            }
        }
    })
})


router.post("/screenvideo", upload.single("chunk"), async (req, res) => {
    let result = req.file
    let resultBody = req.body
    const folderPath = path.join(__dirname, `../${resultBody.id}`);
    const SSfolderPath = path.join(__dirname, `../${resultBody.id}/screenshare`);

    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
    }
    if (!fs.existsSync(SSfolderPath)) {
        fs.mkdirSync(SSfolderPath);
    }

    function mergeScreenVideo() {
        fs.readdir(SSfolderPath, (err, files) => {
            if (err) {
                console.error('Error reading folder:', err);
                return res.status(500).send('Error reading folder.');
            } else {
                const videoFiles = files.filter(file => path.extname(file) === '.webm');

                const inputFiles = videoFiles.map(file => path.join(SSfolderPath, file));

                const outputFilePath = path.join(SSfolderPath, `${result.originalname}${resultBody.recordnumber + 100}.webm`);

                const ffmpegCommand = ffmpeg()

                inputFiles.forEach((inputFile) => {
                    ffmpegCommand.input(inputFile)
                });

                ffmpegCommand
                    .on('error', function (err) {
                        console.log('Error ' + err.message);
                    })
                    .on('end', function () {
                        inputFiles.forEach((inputFile) => {
                            fs.unlink(inputFile, (err) => {
                                if (err) {
                                    console.error(err);
                                }
                            });
                        });
                    })
                    .mergeToFile(outputFilePath);
            }
        });
    }

    const updateStudent = async (studentID, date) => {
        try {
            const candidate = await Candidate.findOne({
                "Students._id": studentID
            });
            const resp = await Candidate.updateOne({
                _id: candidate._id,
                Students: {
                    $elemMatch: {
                        _id: studentID
                    }
                }
            }, {
                $set: {
                    "Students.$.reviewStatus": "Not Reviewed",
                    "Students.$.status": "Exam submitted",
                    "Students.$.endTime": date

                }
            })
        } catch (error) {
            console.log(error);
        }
    }

    const screenfilePath = path.join(__dirname, `../${resultBody.id}/screenshare/${result.originalname}${resultBody.recordnumber}.webm`)

    fs.writeFile(screenfilePath, result.buffer, err => {
        if (err) {
            console.error('Error saving file:', err);
        } else {
            res.status(200).send('Data processed successfully');
            if (resultBody.refreshed === "true") {
                screenscheduler = schedule.scheduleJob(resultBody.timer, () => {
                    mergeScreenVideo()
                    updateStudent(resultBody.id, resultBody.date)
                })
            } else if (resultBody.refreshed === "null") {
                mergeScreenVideo()
            }
        }
    })
})


router.get("/cancelschedule", async (req, res) => {

    if (webscheduler !== null) {
        webscheduler.cancel()
        webscheduler = null
    }

    if (screenscheduler !== null) {
        screenscheduler.cancel()
        screenscheduler = null
    }

})

router.post("/fetchsavedphotos", async (req, res) => {
    let searchTerm = req.body.id
    try {
        const data = await Record.findOne({ "RandomID": searchTerm });
        res.send({ status: "OK", data: data })
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

router.post("/saveidphoto", (req, res) => {
    let result = req.body
    const update = async (randomID) => {
        try {
            const res = await Record.updateOne({ RandomID: randomID }, {
                $set: {
                    IDPhoto: result.IDPhoto
                }
            })
        } catch (error) {
            console.log(error);
        }
    }
    update(result.RandomID)
})

router.get("/fetchdata", async (req, res) => {
    try {
        const data = await Candidate.find();
        res.send({ status: "OK", data: data })
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

router.get("/fetchexam/:id", async (req, res) => {
    const id = req.params.id

    try {
        const data = await Candidate.find({ "AdminSessionId": id });
        res.send({ status: "OK", data: data })
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

router.get("/fetchscreen/:id", async (req, res) => {
    const id = req.params.id
    const SSfolderPath = path.join(__dirname, `../${id}/screenshare`);
    fs.readdir(SSfolderPath, (err, files) => {
        if (err) {
            return res.send('Error reading folder.');
        } else {
            const videoFiles = files.filter(file => path.extname(file) === '.webm');
            if (videoFiles.length === 0) {
                return res.status(404).send('No video files found.');
            }
            const inputFiles = videoFiles.map(file => path.join(SSfolderPath, file));
            res.setHeader('Content-Type', 'video/webm');
            res.sendFile(inputFiles[0], (err) => {
                if (err) {
                    console.error('Error sending file:', err);
                    return res.status(500).send('Error sending file.');
                }
            });
        }
    })
})

router.get("/fetchwebcam/:id", async (req, res) => {
    const id = req.params.id
    const webcamFolderPath = path.join(__dirname, `../${id}/webcam`);
    fs.readdir(webcamFolderPath, (err, files) => {
        if (err) {
            return res.send('Error reading folder.');
        } else {
            const videoFiles = files.filter(file => path.extname(file) === '.webm');
            if (videoFiles.length === 0) {
                return res.status(404).send('No video files found.');
            }
            const inputFiles = videoFiles.map(file => path.join(webcamFolderPath, file));
            res.setHeader('Content-Type', 'video/webm');
            res.sendFile(inputFiles[0], (err) => {
                if (err) {
                    console.error('Error sending file:', err);
                    return res.status(500).send('Error sending file.');
                }
            });
        }
    })
})

router.post("/examid", async (req, res) => {
    const id = req.body.id;
    const studentID = req.body.studentID;
    try {
        if (studentID) {
            const data = await Candidate.findOne({ "Students.studentSessionId": studentID }, { Students: { $elemMatch: { "studentSessionId": studentID } } })
            const data2 = await Candidate.findOne({ "Students.studentSessionId": studentID })
            res.send({ status: "OK", data: [data, data2] })
        } else if (id) {
            const data3 = await Candidate.findOne({ "AdminSessionId": id })
            res.send({ status: "OK", data: data3 })
        }
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

router.post("/candidateid", async (req, res) => {
    const searchTerm = req.body.id;
    try {
        const data = await Candidate.findOne({ "Students._id": searchTerm }, { Students: { $elemMatch: { "_id": searchTerm } } });
        const data2 = await Candidate.findOne({ "Students._id": searchTerm })
        res.send({ status: "OK", data: [data, data2] })
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
})

router.post("/candidateinsetup/:id", async (req, res) => {
    const id = req.params.id
    const { mainID } = req.body;
    const update = async (_id, studentID) => {
        try {
            const resp = await Candidate.updateOne({
                _id,
                Students: {
                    $elemMatch: {
                        _id: studentID,
                    }
                }
            }, {
                $set: {
                    "Students.$.status": "In Setup",
                }
            })
            res.send({ status: "OK" })

        } catch (error) {
            console.log(error);
        }
    }
    update(mainID, id)
})

router.post("/startexam", async (req, res) => {
    const { id, mainID, date } = req.body;
    const update = async (_id, studentID, date) => {
        try {
            const resp = await Candidate.updateOne({
                _id,
                Students: {
                    $elemMatch: {
                        _id: studentID,
                    }
                }
            }, {
                $set: {
                    "Students.$.status": "Exam started",
                    "Students.$.startTime": date
                }
            })
            res.send({ status: "OK" })

        } catch (error) {
            console.log(error);
        }
    }
    update(mainID, id, date)
})

router.post("/finishexam", async (req, res) => {
    const { id, mainID, date } = req.body;
    const update = async (_id, studentID, date) => {
        try {
            const resp = await Candidate.updateOne({
                _id,
                Students: {
                    $elemMatch: {
                        _id: studentID
                    }
                }
            }, {
                $set: {
                    "Students.$.reviewStatus": "Not Reviewed",
                    "Students.$.status": "Exam submitted",
                    "Students.$.endTime": date

                }
            })
            res.send({ status: "OK" })

        } catch (error) {
            console.log(error);
        }
    }
    update(mainID, id, date)
})

router.post("/resetreview", async (req, res) => {
    const { id, mainID, reviewStatus, resetStatus } = req.body;
    const update = async (_id, studentID) => {
        try {
            const resp = await Candidate.updateOne({
                _id,
                Students: {
                    $elemMatch: {
                        studentSessionId: studentID
                    }
                }
            }, {
                $set: {
                    "Students.$.reviewStatus": reviewStatus,
                    "Students.$.flagColor": resetStatus.flagColor,
                    "Students.$.finalComment": resetStatus.finalComment,
                }
            })
            res.send({ status: "OK" })

        } catch (error) {
            console.log(error);
        }
    }
    update(mainID, id)
})

router.get("/deletesession/:id", async (req, res) => {
    const id = req.params.id;

    const deletesession = async (AdminSessionId) => {
        try {
            const resp = await Candidate.deleteOne({ AdminSessionId })
            const response = await Record.deleteMany({ AdminSessionId })
            res.send({ data: "Session deleted successfully" })
        } catch (error) {
            res.send({ data: "Something went wrong" })
        }
    }

    deletesession(id)
})

router.post("/addincident/:id/:studentid", async (req, res) => {
    const id = req.params.id;
    const studentid = req.params.studentid;
    const incident = req.body.myIncis;

    const addincident = async (AdminSessionId, studentSessionId, incidents) => {
        try {
            const resp = await Candidate.updateOne({
                AdminSessionId,
                "Students.studentSessionId": studentSessionId
            }, {
                $push: {
                    "Students.$.incidents": incidents
                }
            })
            res.send({ data: "Incident added successfully" })
        } catch (error) {
            res.send({ data: "Something went wrong" })
        }
    }

    addincident(id, studentid, incident)
})

router.post("/deleteincident/:id/:studentid", async (req, res) => {
    const id = req.params.id;
    const studentid = req.params.studentid;
    const incident = req.body.Inci;

    const deleteIncident = async (AdminSessionId, studentSessionId, incidents) => {
        try {
            const resp = await Candidate.updateOne({
                AdminSessionId,
                "Students.studentSessionId": studentSessionId,
            }, {
                $pull: {
                    "Students.$.incidents": {
                        sno: incidents.sno,
                        name: incidents.name
                    }
                }
            })
            res.send({ data: "Incident deleted successfully" })
        } catch (error) {
            res.send({ data: "Something went wrong" })
        }
    }

    deleteIncident(id, studentid, incident)
})

router.get("/deletesession/:id/:studentsessionid", async (req, res) => {
    const id = req.params.id;
    const studentsessionid = req.params.studentsessionid.split(",");

    const deletesession = async (AdminSessionId) => {
        try {
            studentsessionid.forEach((sessionid) => {
                const folderPath = path.join(__dirname, `../${sessionid}`);
                if (fs.existsSync(folderPath)) {
                    fs.rm(folderPath, { recursive: true }, async (err) => {
                        if (err) {
                            console.error(`Error deleting folder: ${err.message}`);
                        } else {
                            const resp = await Candidate.deleteOne({ AdminSessionId })
                            const response = await Record.deleteMany({ AdminSessionId })
                        }
                    })
                }
            })
            res.send({ data: "Session deleted successfully" })
        } catch (error) {
            console.log(error);
            res.send({ data: "Something went wrong" })
        }
    }

    deletesession(id)
})

router.get("/deletestudent/:id/:studentid", async (req, res) => {
    const id = req.params.id;
    const studentid = req.params.studentid;
    const deletesession = async (AdminSessionId, _id) => {
        try {
            const folderPath = path.join(__dirname, `../${_id}`);
            if (fs.existsSync(folderPath)) {
                fs.rm(folderPath, { recursive: true }, async (err) => {
                    if (err) {
                        console.error(`Error deleting folder: ${err.message}`);
                    } else {
                        const resp = await Candidate.updateOne({
                            AdminSessionId
                        }, {
                            $pull: {
                                Students: {
                                    _id
                                }
                            }
                        })
                        res.send({ data: "Student removed successfully" })
                    }
                })
            }

        } catch (error) {
            console.log(error);
            res.send({ data: "Something went wrong" })
        }
    }
    deletesession(id, studentid)
})




module.exports = router;