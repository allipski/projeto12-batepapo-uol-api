import express from "express";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";
import cors from "cors";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect(() => {
  db = mongoClient.db("batepapo-uol");
});

// participants

app.post("/participants", async (req, res) => {
  const name = req.body.name;

  const nameSchema = joi.object({
    name: joi.string().required(),
  });

  const validation = nameSchema.validate({ name: name }, { abortEarly: true });
  if (validation.error) {
    return res.sendStatus(422);
  }

  try {
    const repetido = await db
      .collection("participants")
      .findOne({ name: name });
    if (repetido) {
      return res.sendStatus(409);
    } else {
      await db
        .collection("participants")
        .insertOne({ name: name, lastStatus: Date.now() });
      await db.collection("messages").insertOne({
        from: name,
        to: "Todos",
        text: "entra na sala...",
        type: "status",
        time: dayjs().format("HH:mm:ss"),
      });
      return res.sendStatus(201);
    }
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

app.get("/participants", async (req, res) => {
  try {
    const participants = await db.collection("participants").find().toArray();
    res.send(participants);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

// messages

app.post("/messages", async (req, res) => {
  const { to: to, text: text, type: type } = req.body;
  const user = req.headers.user;

  const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid("private_message", "message").required(),
  });

  const validation = messageSchema.validate(
    { to: to, text: text, type: type },
    { abortEarly: true }
  );

  const validarFrom = await db
    .collection("participants")
    .findOne({ name: user });
  console.log(validarFrom);

  if (validation.error || !validarFrom) {
    return res.sendStatus(422);
  }

  try {
    await db.collection("messages").insertOne({
      from: user,
      to: to,
      text: text,
      type: type,
      time: dayjs().format("HH:mm:ss"),
    });
    return res.sendStatus(201);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

app.get("/messages", async (req, res) => {
  const user = req.headers.user;
  const limit = parseInt(req.query.limit);

  try {
    const received = await db.collection("messages").find().toArray();
    const messages = received.filter(
      (message) =>
        message.type === "message" ||
        message.to === user ||
        message.from === user
    );
    if (!limit) {
      res.send(messages);
    } else {
      res.send(messages.slice(-limit));
    }
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

// status

app.post("/status", async (req, res) => {
  const user = req.headers.user;

  try {
    const encontrar = await db
      .collection("participants")
      .findOne({ name: user });
    if (!encontrar) {
      return res.sendStatus(404);
    } else {
      await db
        .collection("participants")
        .updateOne(encontrar, { $set: { lastStatus: Date.now() } });
      return res.sendStatus(200);
    }
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

app.listen(5000, () => {
  console.log("Server is listening on port 5000.");
});

async function removeInactive() {
  try {
    console.log('teste')
    const all = await db.collection("participants").find().toArray();
    const toDelete = all.filter(
      (user) => Date.now() - user.lastStatus > 10000
    );
    if (toDelete.length != 0) {
      console.log('teste2');
      const ids = toDelete.map((user) => user._id);
      const leave = toDelete.map((item) => {
        return {
          from: item.name,
          to: "Todos",
          text: "sai da sala...",
          type: "status",
          time: "HH:mm:ss",
        };
      });
      await db.collection("messages").insertMany(leave);
      await db.collection("participants").deleteMany({ _id: { $in: ids } });
      console.log('deletou');
    } else {
      console.log('nada pra deletar');
      return false;
    }
  } catch (error) {
    console.error(error);
  }
}

setInterval(removeInactive, 15000);
