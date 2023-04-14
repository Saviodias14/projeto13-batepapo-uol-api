import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb"
import dotenv from "dotenv"
import dayjs from "dayjs"

const app = express()

app.use(express.json())
app.use(cors())
dotenv.config()

let db
const mongoClient = new MongoClient(process.env.DATABASE_URL)
mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch((err) => console.log(err.message))

app.post("/participants", async (req, res) => {
    const { name } = req.body
    if (typeof (name) !== "string" || !name) return res.sendStatus(422)
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
const PORT = 5000
app.listen(PORT, () => console.log(`A aplicação está rodando na porta ${PORT}`))