const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;

// middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.z6box3t.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const categoryCollection = client.db("bookMinderDB").collection("category");
    const booksCollection = client.db("bookMinderDB").collection("books");
    const borrowCollection = client.db("bookMinderDB").collection("borrow");


    
    // category get operation
    app.get("/api/v1/category", async (req, res) => {
      const cursor = categoryCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // books get operation
    app.get("/api/v1/books", async (req, res) => {
      const cursor = booksCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // borrow book get operation
    app.get("/api/v1/borrow", async (req, res) => {
      const cursor = borrowCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // books get operation by id based
    app.get("/api/v1/books/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await booksCollection.findOne(query);
      res.send(result);
    });

    // books post operation
    app.post("/api/v1/books", async (req, res) => {
      const newBooks = req.body;
      const result = await booksCollection.insertOne(newBooks);
      res.send(result);
    });

    // borrow book post operation
    app.post("/api/v1/borrow", async (req, res) => {
      const newBorrowCard = req.body;
      const bookId = newBorrowCard.bookName;
      const bookQuery = { name: bookId };
      const borrowedBook = await booksCollection.findOne(bookQuery);

      if (borrowedBook.quantity > 0) {
        const borrowResult = await borrowCollection.insertOne(newBorrowCard);
        const updatedBookQuantity = borrowedBook.quantity - 1;

        if (updatedBookQuantity >= 0) {
          const bookUpdateResult = await booksCollection.updateOne(bookQuery, {
            $set: { quantity: updatedBookQuantity },
          });
          res.send({ borrowResult, bookUpdateResult });
        } else {
          res
            .status(400)
            .send({ message: "Not enough books in stock to borrow" });
        }
      } else {
        res.status(400).send({ message: "No books available to borrow" });
      }
    });

    // updated books
    app.put("/api/v1/books/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedBooks = req.body;
      const books = {
        $set: {
          image: updatedBooks.image,
          name: updatedBooks.name,
          quantity: updatedBooks.quantity,
          author: updatedBooks.author,
          category: updatedBooks.category,
          rating: updatedBooks.rating,
          description: updatedBooks.description,
        },
      };
      const result = await booksCollection.updateOne(filter, books, options);
      res.send(result);
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
  res.send("book minder server is running");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
