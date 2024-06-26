const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

//middleWire
app.use(cors());
app.use(express.json());

//verify token 
const verifyToken = (req, res, next) => {
  //console.log('inside verify token', req.headers.authorization);
  if (!req.headers.authorization) {
    return res.status(401).send({ message: 'forbidden access' });
  }
  const token = req.headers.authorization.split(' ')[1];
  jwt.verify(token, process.env.DB_ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'forbidden access' });
    }
    req.decoded = decoded;
    next();
  })
  // next();
}





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.khblnbj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    //
    const menuCollection = client.db("bistroDB").collection('menu');
    const cartsCollection = client.db("bistroDB").collection('carts');
    const usersCollection = client.db("bistroDB").collection('users');

    //verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next();
    }

    //jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.DB_ACCESS_TOKEN, { expiresIn: '1h' });
      res.send({ token });
    })
    //users  related  api
    //get
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {

      const result = await usersCollection.find().toArray();
      res.send(result);
    })
    //return admin or not 
    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Unauthorized access' });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        if (user?.role === 'admin') {
          admin = true;
        }
      }
      res.send({ admin })
    })
    
    //post
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })
    //user delete
    app.delete('/users/:id',verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    })
    // make a user as a admin
    app.patch('/users/admin/:id',verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })
    //menu related api
    //menu get
    app.get('/menu', async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result)
    })
    //menu post
    app.post('/menu',verifyToken, verifyAdmin,async (req,res) => {
         const item = req.body;
         const result = await menuCollection.insertOne(item);
         res.send(result);
    })
    //menu delete 
    app.delete('/menu/:id',verifyToken, verifyAdmin,async(req,res) => {
          const id = req.params.id;
          const query = {_id: new ObjectId(id)};
          const result = await menuCollection.deleteOne(query);
          res.send(result);
    })
    // for carts
    //get
    app.get('/carts', async (req, res) => {
      const email = req.query.email;
      // console.log(email)
      const query = { email: email };
      const result = await cartsCollection.find(query).toArray();
      res.send(result);
    })
    //post
    app.post('/carts', async (req, res) => {
      const cart = req.body;
      const result = await cartsCollection.insertOne(cart);
      res.send(result);
    })
    //delete cart
    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      //console.log(id)
      const query = { _id: new ObjectId(id) };
      const result = await cartsCollection.deleteOne(query);
      res.send(result);
    })

    //stats or analytics
    app.get('/admin-stats', async (req,res) => {
          const users = await usersCollection.estimatedDocumentCount();
          const menuItems = await menuCollection.estimatedDocumentCount();

          res.send({
            users,
            menuItems
          })
    }) 
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send("Bistro Boss is Running");
})

app.listen(port, () => {
  console.log(`Bistro Boss Restaurant server is running on prot ${port}`)
})