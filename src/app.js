import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb"
import dotenv from "dotenv"
import dayjs from "dayjs"

const app = express()

app.use(express.json())
app.use(cors())
dotenv.config()
function isString(param) {
    if (typeof (param) !== "string" || !param) return true
    return false
}
let db
const mongoClient = new MongoClient(process.env.DATABASE_URL)
mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch((err) => console.log(err.message))

app.post("/participants", async (req, res) => {
    const { name } = req.body
    if (isString(name)) return res.sendStatus(422)
    try {
        const test = await db.collection("participants").findOne({ name })
        if (test) return res.sendStatus(409)

        const newDate = Date.now()
        await db.collection("participants").insertOne({ name, lastStatus: newDate })
        await db.collection("messages").insertOne({
            from: name,
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
    if (isString(to) || isString(text) || (type !== "private_message" && type !== "message") || !user) {
        console.log(user)
        return res.sendStatus(422)
    }
    try {
        const participant = await db.collection("participants").findOne({ name: user })
        if (!participant) return res.sendStatus(422)
        await db.collection("messages").insertOne({
            from: user,
            to,
            text,
            type,
            time: dayjs(Date.now()).format("HH:mm:ss")
        })
        res.sendStatus(201)
    } catch (err) {
        res.status(500).send(err.message)
    }
})

app.get("/messages", (req, res) => {
    const { User } = req.headers
    const { limit } = req.query
    console.log(limit)
    db.collection("messages").find({$or: [{ type: "public" }, { to: "Todos" }, { to: User }, { from: User }]}).toArray()
        .then(messages => {
            if (!limit && limit !== 0) {
                return res.status(201).send(messages)
            }
            if (limit > 0) {
                const filteredMessages = messages.slice(-limit)
                return res.status(201).send(filteredMessages)
            }
            res.sendStatus(422)
        })
        .catch(err => res.status(500).send(err.message))
})

const PORT = 5000
app.listen(PORT, () => console.log(`A aplicação está rodando na porta ${PORT}`))