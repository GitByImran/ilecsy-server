const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

app.use(express.json());
app.use(cors());

const verifyAuth = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: "access denied" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "access denied" });
    }
    req.decoded = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.AUTH}:${process.env.PASS}@cluster0.fgunpt2.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const productCollection = client.db("ilecsy").collection("products");
    const userCollection = client.db("ilecsy").collection("users");

    //jwt
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS);
      res.header("Content-Type", "application/json");
      res.send({ token });
    });

    //products
    app.get("/", (req, res) => {
      res.send("server connected");
    });
    app.get("/products", async (req, res) => {
      const result = await productCollection.find().toArray();
      res.send(result);
    });

    // users
    app.post("/users", async (req, res) => {
      const user = req.body;
      const { email } = user;

      const existingUser = await userCollection.findOne({ email });
      if (existingUser) {
        return res.status(409).send({ message: "Email already exists" });
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.put("/users/:userId", verifyAuth, async (req, res) => {
      const userId = req.params.userId;
      const { name, email, url } = req.body;

      try {
        const updates = {};
        if (name) updates.name = name;
        if (email) updates.email = email;
        if (url) updates.url = url;

        const updatedUser = await userCollection.findOneAndUpdate(
          { _id: new ObjectId(userId) },
          { $set: updates },
          { returnOriginal: false }
        );

        if (!updatedUser.value) {
          return res.status(404).send({ message: "User not found" });
        }

        res.send(updatedUser.value);
      } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // other
    console.log(
      "Connected to MongoDB! Server is listening on port " +
        (process.env.PORT || 5000)
    );
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  } finally {
    //
  }
}
run().catch(console.dir);

app.listen(process.env.PORT || 5000);
