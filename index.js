const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
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
    // await client.connect();

    const categoryCollection = client.db("bookMinderDB").collection("category");
    const booksCollection = client.db("bookMinderDB").collection("books");
    const borrowCollection = client.db("bookMinderDB").collection("borrow");
    await borrowCollection.createIndex(
      { email: 1, bookName: 1 },
      { unique: true }
    );

    // auth realted api
    app.post("/api/v1/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
        })
        .send({ success: true });
    });

    app.post("/api/v1/logout", async (req, res) => {
      const user = req.body;
      res.clearCookie("token", { maxAge: 0, secure: true, sameSite: 'none' }).send({ success: true });
    });

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

    // books get operation by id based
    app.get("/api/v1/books/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await booksCollection.findOne(query);
      res.send(result);
    });

    // borrow get operation by id based
    app.get("/api/v1/borrow-book/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await borrowCollection.findOne(query);
      res.send(result);
    });

    // borrowed book get operating by email
    app.get("/api/v1/borrow-book", async (req, res) => {
      if (req.query.email !== req.user.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      let query = {};
      if (req.query?.email) {
        query = { email: req.query?.email };
      }

      const result = await borrowCollection.find(query).toArray();
      res.send(result);
    });

    // books post operation
    app.post("/api/v1/books", async (req, res) => {
      const newBooks = req.body;
      const bookname = newBooks.name;
      const existingBook = await booksCollection.findOne({ name: bookname });
      if (existingBook) {
        return res
          .status(400)
          .send({ message: "A book with the same name already exists" });
      }

      const result = await booksCollection.insertOne(newBooks);
      res.send(result);
    });

    // borrow book post operation
    app.post("/api/v1/borrow-book", async (req, res) => {
      const newBorrowCard = req.body;
      const bookname = newBorrowCard.bookName;
      const bookQuery = { name: bookname };
      const borrowedBook = await booksCollection.findOne(bookQuery);

      try {
        // Attempt to insert the document into the borrowCollection
        const borrowResult = await borrowCollection.insertOne(newBorrowCard);

        // If successful, update the book quantity
        const updatedBookQuantity = borrowedBook.quantity - 1;

        if (updatedBookQuantity >= 0) {
          const bookUpdateResult = await booksCollection.updateOne(bookQuery, {
            $set: { quantity: updatedBookQuantity },
          });
          res.send({ borrowResult, bookUpdateResult });
        }
      } catch (error) {
        // Handle duplicate key error
        if (error.code === 11000) {
          res.status(400).send({
            message:
              "Duplicate entry. This book is already borrowed by the user.",
          });
        } else {
          // Handle other errors
          res.status(500).send({ message: "Internal server error" });
        }
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

    // delete a borrow book data
    app.delete("/api/v1/borrow-book/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      try {
        // Find the borrowed book first to get its details
        const borrowedBook = await borrowCollection.findOne(query);

        if (!borrowedBook) {
          res.status(404).send({ message: "Borrowed book not found" });
          return;
        }

        // Delete the borrowed book document
        const deleteResult = await borrowCollection.deleteOne(query);

        // Increase the quantity of the book in booksCollection
        const bookQuery = { name: borrowedBook.bookName };
        const intQuantity = parseInt(borrowedBook.quantity);
        const updatedBookQuantity = intQuantity + 1 - 1;

        // Update the book quantity in booksCollection
        const bookUpdateResult = await booksCollection.updateOne(bookQuery, {
          $set: { quantity: updatedBookQuantity },
        });

        res.send({ deleteResult, bookUpdateResult });
      } catch (error) {
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
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
