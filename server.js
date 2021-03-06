require('dotenv').config();
const cosmos = require('@azure/cosmos').CosmosClient;
const express = require('express');
const multer = require('multer'); //Multer adds a body object and a file object to the request object. The body object contains the values of the text fields of the form, the file object contains the files uploaded via the form.
const {
    Aborter,
    BlockBlobURL,
    ContainerURL,
    ServiceURL,
    StorageURL,
    SharedKeyCredential,
    uploadStreamToBlockBlob
  } = require("@azure/storage-blob");
const port = 8080; // Define port for app to listen on
const app =  express();
const inMemoryStorage = multer.memoryStorage();
const uploadStrategy = multer({ storage: inMemoryStorage }).single('image');
const getStream = require('into-stream');
const containerName = 'images';
const ONE_MEGABYTE = 1024 * 1024; // helps to reveal the intent of file size calculations during upload operations.
const uploadOptions = { bufferSize: 4 * ONE_MEGABYTE, maxBuffers: 20 };
const ONE_MINUTE = 60 * 1000;
const sharedKeyCredential = new SharedKeyCredential(
    process.env.AZURE_STORAGE_ACCOUNT_NAME,
    process.env.AZURE_STORAGE_ACCOUNT_ACCESS_KEY);
const pipeline = StorageURL.newPipeline(sharedKeyCredential);
const serviceURL = new ServiceURL(
    `https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`,
    pipeline
  );

const getBlobName = originalName => {
  // Use a random number to generate a unique file name, 
  // removing "0." from the start of the string.
  const identifier = Math.random().toString().replace(/0\./, ''); 
  return `${identifier}-${originalName}`;
};


app.use(express.static('.'));  // making current directory as a static directory
app.use(express.json());
app.use(express.urlencoded({ extended: false })); 
const containerURL = ContainerURL.fromServiceURL(serviceURL, containerName);

app.post('/profile', uploadStrategy, async (req, res) => {
  const aborter = Aborter.timeout(30 * ONE_MINUTE); // used to define timeouts when running code
  const blobName = getBlobName(req.file.originalname);
  const stream = getStream(req.file.buffer);
  const blockBlobURL = BlockBlobURL.fromContainerURL(containerURL, blobName);

  try {
      
    await uploadStreamToBlockBlob(aborter, stream,
    blockBlobURL, uploadOptions.bufferSize, uploadOptions.maxBuffers);
    
    res.redirect('/');   

  } catch (err) {

    res.send(err); 

  }
});

const nosql = new cosmos( {endpoint: process.env.AZURE_COSMOS_URI, auth: { 
  masterKey: process.env.AZURE_COSMOS_PRIMARY_KEY
}});


// nosql.database('nac').container('jh').items.readAll().toArrary().then(res => console.log(res.result))
    


app.get('/', (req, res) => {    // GET / route for serving index.html file
res.render('index.html'); 
});

app.get('/images', (req, res) => {
  containerURL.listBlobFlatSegment(Aborter.none)
    .then(listBlobResponse => {
        res.json(listBlobResponse.segment.blobItems.map(item => {
            return `${containerURL.storageClientContext.url}/${item.name}`;
        }));
    });
});

app.listen(port, () => {   // To make the server live
console.log(`App is live on port ${port}`);
});