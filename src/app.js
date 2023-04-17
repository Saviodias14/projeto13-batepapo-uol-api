import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb"
import dotenv from "dotenv"
import dayjs from "dayjs"
import { stripHtml } from "string-strip-html"
import joi from "joi"

const app = express()

app.use(express.json())
app.use(cors())
dotenv.config()
function isString(param) {
    if (typeof (param) !== "string" || !param) return true
    return false
}

const nameSchema = joi.object({ name: joi.string().required() })

const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required()
})
let db
const mongoClient = new MongoClient(process.env.DATABASE_URL)
mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch((err) => console.log(err.message))

app.post("/participants", async (req, res) => {
    const { name } = req.body
    const validation = nameSchema.validate({ name }, { abortEarly: false })
    if (validation.error) {
        const errors = validation.error.details.map((detail) => detail.message)
        return res.status(422).send(errors)
    }
    try {
        const test = await db.collection("participants").findOne({ name: stripHtml(name.trim()).result })
        if (test) return res.sendStatus(409)

        const newDate = Date.now()
        await db.collection("participants").insertOne({ name: stripHtml(name.trim()).result, lastStatus: newDate })
        await db.collection("messages").insertOne({
            from: stripHtml(name.trim()).result,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs(newDate).format("HH:mm:ss")
        })
        res.sendStatus(201)
    } catch (err) {
        res.status(500).send(err.message)
    }
})

app.get("/participants", (req, res) => {
    db.collection("participants").find().toArray()
        .then(participants => res.status(201).send(participants))
        .catch(err => res.status(500).send(err.message))
})

app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body
    const { user } = req.headers
    const validation = messageSchema.validate({ to, text:stripHtml(text.trim()).result }, { abortEarly: false })
    if(validation.error){
        const errors = validation.error.details.map((detail) => detail.message)
        return res.status(422).send(errors)
    }
    if ((type !== "private_message" && type !== "message") || !user) {
        return res.sendStatus(422)
    }
    try {
        const participant = await db.collection("participants").findOne({ name: user })
        if (!participant) return res.sendStatus(422)
        await db.collection("messages").insertOne({
            from: user,
            to,
            text: stripHtml(text.trim()).result,
            type,
            time: dayjs(Date.now()).format("HH:mm:ss")
        })
        res.sendStatus(201)
    } catch (err) {
        res.status(500).send(err.message)
    }
})

app.get("/messages", (req, res) => {
    const { user } = req.headers
    const { limit } = req.query
    db.collection("messages").find({ $or: [{ type: "message" }, { to: "Todos" }, { to: user }, { from: user }] }).toArray()
        .then(messages => {
            if (!limit && limit !== 0) {
                return res.send(messages)
            }
            if (limit > 0) {
                const filteredMessages = messages.slice(-limit)
                return res.send(filteredMessages)
            }
            res.sendStatus(422)
        })
        .catch(err => res.status(500).send(err.message))
})

app.post("/status", async (req, res) => {
    const { user } = req.headers
    if (!user) return res.sendStatus(404)
    try {
        const isParticipant = await db.collection("participants").findOne({ name: user })
        if (!isParticipant) return res.sendStatus(404)
        db.collection("participants").updateOne({ name: user }, { $set: { lastStatus: Date.now() } })
        res.sendStatus(200)
    } catch (err) {
        res.status(500).send(err.message)
    }
})

app.delete("/messages/ID_DA_MENSAGEM", async (req, res) => {
    const { user } = req.headers
    const { id } = req.params
    try {
        const existId = await db.collection("messages").findOne({ _id: new ObjectId(id) })
        if (!existId) return res.sendStatus(404)
        if (user !== existId.from) return res.sendStatus(401)
        await db.collection("messages").deleteOne({ _id: new ObjectId(id) })
        res.sendStatus(200)
    } catch (err) {
        res.status(500).send(err.message)
    }
})

app.put("/messages/ID_DA_MENSAGEM", (req, res) => {

})

setInterval(async () => {
    const time = Date.now() - 10000
    try {
        const listOfParticipants = await db.collection("participants").find({ lastStatus: { $lt: time } }).toArray()
        console.log(listOfParticipants)
        await db.collection("participants").deleteMany({ lastStatus: { $lt: time } })
        listOfParticipants.forEach((participant) => {
            db.collection("messages").insertOne({
                from: participant.name,
                to: 'Todos',
                text: 'sai da sala...',
                type: 'status',
                time: dayjs(Date.now()).format("HH:mm:ss")
            })
        })
    } catch (err) {
        res.status(500).send(err.message)
    }
}, 15000)
const PORT = 5000
app.listen(PORT, () => console.log(`A aplicação está rodando na porta ${PORT}`))