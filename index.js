const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
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
  }
});



const verifyJWT=(req,res,next)=>{
  const authorization=req.headers.authorization;
  console.log('autho', authorization)
  if(!authorization){
    return res.status(401).send({error:true,message:'unauthorized access'})
  }
  const token=authorization.split(' ')[1];
  jwt.verify(token,process.env.SECRET_TOKEN,(err,decoded)=>{
    if(err){
      return res.status(401).send({error:true, message:'unauthorized access'})

    }
    req.decoded=decoded;
    console.log(req.decoded);
    next();
  })
 }

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db("shutterCamp").collection("users");
    const classesCollection= client.db("shutterCamp").collection("classes");


  

    //JWT
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const jsonToken = jwt.sign(user, process.env.SECRET_TOKEN, {
        expiresIn: "10h",
      });
      res.send({ jsonToken });
    });


    //verify Admin 
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden access for general user' });
      }
      next();
    }

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

    app.get('/users/admin/:email',verifyJWT, async (req, res) => {
      const email = req.params.email;
      console.log('admin',email)

      if (req.decoded.email !== email) {
        console.log('decoded email',req.decoded.email)
        return res.send({ admin: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })
    app.get('/users/instructor/:email',verifyJWT, async (req, res) => {
      const email = req.params.email;
      console.log('instructor',email)
      if (req.decoded.email !== email) {
        return res.send({ instructor: false })
      }
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === 'instructor' }
      console.log(result)
      res.send(result);
    })

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
          role: "instructor"
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //classes related api
    app.get('/classes', async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    })

    app.post('/classes', async (req, res) => {
      const newClass = req.body;
      console.log(newClass)
      const result = await classesCollection.insertOne(newClass)
      res.send(result);
    })
     //make approve
     app.patch("/classes/approve/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "approve"
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Shutter Camp is waiting to click image')
  })
  
  app.listen(port, () => {
    console.log(`Shutter camp is running on port:  ${port}`)
  })