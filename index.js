const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const stripe = require("stripe")(process.env.PAYMENT_KEY);
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.7cqr184.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  console.log(req.headers)
  console.log("autho", authorization);
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.SECRET_TOKEN, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    console.log(req.decoded);
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const usersCollection = client.db("shutterCamp").collection("users");
    const classesCollection = client.db("shutterCamp").collection("classes");
    const selectedClassesCollection = client
      .db("shutterCamp")
      .collection("selectedClasses");
    const paymentCollection = client.db("shutterCamp").collection("payments");

    // //JWT
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const jsonToken = jwt.sign(user, process.env.SECRET_TOKEN, {
        expiresIn: "10h",
      });
      res.send({ jsonToken });
    });

    // //verify Admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access for general user" });
      }
      next();
    };

    //Users
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      // console.log(user);
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      // console.log("user already exist", existingUser);
      if (existingUser) {
        return res.send({ message: "already exist" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users/admin/:email",  async (req, res) => {
      const email = req.params.email;
      console.log("admin", email);

      // if (req.decoded.email !== email) {
      //   console.log("decoded email", req.decoded.email);
      //   return res.send({ admin: false });
      // }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });
    app.get("/users/instructor/:email",  async (req, res) => {
      const email = req.params.email;
      console.log("instructor", email);
      // if (req.decoded.email !== email) {
      //   return res.send({ instructor: false });
      // }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      console.log(result);
      res.send(result);
    });

    //make admin
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //make instructor
    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    
    //classes related api
    app.get("/classes", async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    app.post("/classes", async (req, res) => {
      const newClass = req.body;
      console.log(newClass);
      const result = await classesCollection.insertOne(newClass);
      res.send(result);
    });
    //make approve
    app.patch("/classes/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "approved",
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //make deny
    app.put("/classes/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "denied", feedback:req.body.feedback
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //popular classes
    app.get("/popularclasses", async (req, res) => {
      const result = await classesCollection
        .find()
        .sort({ enrolled: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });
    //popular instructor
    app.get("/popularinstructor", async (req, res) => {
      const result = await usersCollection
        .find({ role: "instructor" })
        .sort({ students: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // selected Class apis

    app.get("/selected", async (req, res) => {
      const email = req.query?.email;

      console.log("student", email);
      let query = {};
      if (email) {
        query = { studentEmail: email };
        console.log(query);
      }
      const result = await selectedClassesCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/selected", async (req, res) => {
      const item = req.body;
      const result = await selectedClassesCollection.insertOne(item);
      res.send(result);
    });
    app.delete("/selected/:id", async (req, res) => {
      try {
        const id = req.params.id;
        console.log("ID:", id);
        if (!id) {
          throw new Error("Invalid ID");
        }

        const query = { _id: new ObjectId(id) };
        const result = await selectedClassesCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(400).send({ error: "Invalid request" });
      }
    });

    //payment apis
    app.get("/payments", async (req, res) => {
      const result = await paymentCollection
        .find()
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      console.log(req.body);
      const amount = parseInt(price * 100);
      console.log(amount);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments",  async (req, res) => {
      const payment = req.body;
      // console.log(payment)
      const insertResult = await paymentCollection.insertOne(payment);
      // res.send(insertResult)
      const deleteQuery = {
        _id: new ObjectId(payment.pay?._id),
      };
      const deleteResult = await selectedClassesCollection.deleteOne(
        deleteQuery
      );
      const updateQuery = {
        _id: new ObjectId(payment.pay?.classId),
      };
      const updateResult = await classesCollection.updateOne(updateQuery, {
        $inc: { enrolled: 1 },
      });

      const updateSeatsQuery = {
        _id: new ObjectId(payment.pay?.classId),
      };
      const updateSeatsResult = await classesCollection.updateOne(
        updateSeatsQuery,
        {
          $inc: { seats: -1 },
        }
      );
      const classId = payment.pay?.classId;
      const query = { _id: new ObjectId(classId) };

      const classData = await classesCollection.findOne(query);
      const instructorEmail = classData.instructorEmail;

      const updateInstructorQuery = { email: instructorEmail };

      // if instructor has no students field, create one
      const updateInstructorResult = await usersCollection.updateOne(
        updateInstructorQuery,
        {
          $inc: { students: 1 },
        }
      );

      res.send({
        insertResult,
        deleteResult,
        updateResult,
        updateSeatsResult,
        updateInstructorResult,
      });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Shutter Camp is waiting to click image");
});

app.listen(port, () => {
  console.log(`Shutter camp is running on port:  ${port}`);
});
