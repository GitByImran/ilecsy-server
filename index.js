const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
app.use(express.json());
app.use(cors());


const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.AUTH}:${process.env.PASS}@cluster0.fgunpt2.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const stripe = require("stripe")(`${process.env.PAYMENT}`);

async function run() {
  try {
    const productCollection = client.db("ilecsy").collection("products");
    const userCollection = client.db("ilecsy").collection("users");
    const orderCollection = client.db("ilecsy").collection("orders");
    const paymentCollection = client.db("ilecsy").collection("payments");

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

    // Create a new product

    app.post("/products", async (req, res) => {
      const productData = req.body;
      console.log("Received productData:", productData); // Log the received product data

      try {
        // Insert the new product data into the "products" collection
        const result = await productCollection.insertOne(productData);

        if (result.insertedCount === 1) {
          // Send a success response with the newly created product data
          res.status(201).send(result.ops[0]);
        } else {
          res.status(500).send({ message: "Failed to create product" });
        }
      } catch (error) {
        console.error("Error creating product:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });



    app.get("/products", async (req, res) => {
      const result = await productCollection.find().toArray();
      res.send(result);
    });

    app.delete("/products/:productId", async (req, res) => {
      const productId = req.params.productId;

      try {
        const deletedProduct = await productCollection.findOneAndDelete({
          _id: new ObjectId(productId),
        });

        if (!deletedProduct.value) {
          return res.status(404).send({ message: "Product not found" });
        }

        res.send({ message: "Product deleted successfully" });
      } catch (error) {
        console.error("Error deleting product:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.patch("/products/:productId", async (req, res) => {
      const productId = req.params.productId;
      const updatedProduct = req.body;

      console.log(updatedProduct);

      try {
        const existingProduct = await productCollection.findOne({
          _id: new ObjectId(productId),
        });

        if (!existingProduct) {
          return res.status(404).send({ message: "Product not found" });
        }

        // Perform the update for the allowed fields
        const updates = {};
        if (updatedProduct.productName)
          updates.productName = updatedProduct.productName;
        if (updatedProduct.productImage)
          updates.productImage = updatedProduct.productImage;
        if (updatedProduct.availablity)
          updates.availablity = updatedProduct.availablity; 
        if (updatedProduct.price) updates.price = updatedProduct.price;
        if (updatedProduct.tax) updates.tax = updatedProduct.tax;
        if (updatedProduct.category) updates.category = updatedProduct.category;

        const updatedProductResult = await productCollection.findOneAndUpdate(
          { _id: new ObjectId(productId) },
          { $set: updates },
          { returnOriginal: false }
        );

        if (!updatedProductResult.value) {
          return res.status(404).send({ message: "Product not found" });
        }

        res.send(updatedProductResult.value);
        console.log(updatedProductResult);
      } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).send({ message: "Internal server error" });
      }
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

    app.put("/users/:userId", async (req, res) => {
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

    app.patch("/users/:userId", async (req, res) => {
      const userId = req.params.userId;
      const { role } = req.body;

      try {
        const updatedUser = await userCollection.findOneAndUpdate(
          { _id: new ObjectId(userId) },
          { $set: { role } },
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

    app.delete("/users/:userId", async (req, res) => {
      const userId = req.params.userId;

      try {
        const deletedUser = await userCollection.findOneAndDelete({
          _id: new ObjectId(userId),
        });

        if (!deletedUser.value) {
          return res.status(404).send({ message: "User not found" });
        }

        res.send({ message: "User deleted successfully" });
      } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // create payment intent

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;

      const amountInCents = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // payments

    app.post("/payments", async (req, res) => {
      const paymentData = req.body;
      try {
        const result = await paymentCollection.insertOne(paymentData);
        res.status(200).send({ message: "Payment data stored successfully" });
      } catch (error) {
        console.error("Error storing payment data:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });
    app.get("/payments", async (req, res) => {
      const userEmail = req.query.email;

      try {
        let query = {};
        if (userEmail) {
          query = { email: userEmail };
        }
        const result = await paymentCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching payment history:", error);
        res.status(500).json({ error: "Error fetching payment history" });
      }
    });

    app.patch("/payments/:paymentId", async (req, res) => {
      const paymentId = req.params.paymentId;

      try {
        const existingPayment = await paymentCollection.findOne({
          _id: new ObjectId(paymentId),
        });

        if (!existingPayment) {
          return res.status(404).send({ message: "Payment not found" });
        }

        const updates = { status: "delivered" };

        const updatedPayment = await paymentCollection.findOneAndUpdate(
          { _id: new ObjectId(paymentId) },
          { $set: updates },
          { returnOriginal: false }
        );

        if (!updatedPayment.value) {
          return res.status(404).send({ message: "Payment not found" });
        }

        res.send(updatedPayment.value);
      } catch (error) {
        console.error("Error updating payment status:", error);
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
