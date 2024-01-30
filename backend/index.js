const express = require('express');
const app = express();
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const cors = require('cors');

app.use(express.json());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // const user_id = req.params['user_id'];
        const user_id = req.user.email;
        let folder = file.fieldname;
        const lastIndex = folder.lastIndexOf('/');
        if (lastIndex != -1)
            folder = folder.substring(0, lastIndex + 1);
        else
            folder = '';
        const uploadFolder = `./upload/${user_id}${folder}`

        if (!fs.existsSync(uploadFolder)) {
            fs.mkdirSync(uploadFolder, { recursive: true }); // Create subdirectories if needed
        }

        cb(null, uploadFolder);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    },
});
const upload = multer({ storage });

const secretKey = 'your-secret-key';
function generateToken(user) {
  return jwt.sign({ email: user.email }, secretKey, { expiresIn: '24h' });
}

const authenticateUser = (req, res, next) => {
    console.log(req.body);
    console.log(req.headers);
    try {
        const token = req.headers['tokennn'];

        if(!token) {
            return res.status(411).send('Unauthorized');
        }
        const verified = jwt.verify(token, secretKey);

        req.user = verified;
        next();
    } catch(err) {
        console.log(err);
        res.status(411).send('Authentication failed');
    }
}

let users = [];

try {
  const usersJson = fs.readFileSync('users.json', 'utf-8');
  users = JSON.parse(usersJson);
  console.log('Users loaded from users.json:', users);
} catch (error) {
  console.error('Error reading or parsing users.json:', error.message);
}

const saveUsersToFile = () => {
  try {
    fs.writeFileSync('users.json', JSON.stringify(users, null, 2), 'utf-8');
    console.log('Users saved to users.json');
  } catch (error) {
    console.error('Error writing to users.json:', error.message);
  }
};

const doesUserExist = (email) => {
  return users.some(user => user.email === email);
};

const isValidCredentials = (email, password) => {
  return users.some(user => user.email === email && user.password === password);
};

const addUser = (newUser) => {
    users.push(newUser);
    saveUsersToFile(); 
};


app.post('/upload-file/', authenticateUser, upload.any(), (req, res) => {
    const user_id = req.user.email;
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files provided.' });
    }

    const uploadedFiles = req.files.map((file) => ({
        filename: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
    }));

    console.log("here")
    res.json({ message: 'Files uploaded successfully', files: uploadedFiles });
});

app.get('/files', authenticateUser, (req, res) => {
    const user_id = req.user.email;

    const userFolderPath = path.join(__dirname, 'upload', user_id);

    fs.readdir(userFolderPath, (err, files) => {
        console.log(files);
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        const fileDetails = files
            .filter(file => fs.statSync(path.join(userFolderPath, file)).isFile())
            .map(file => {
                const [filename, extension] = file.split('.');
                const fileType = getContentType(file);
                return { file, fileType };
            });

        res.json({ files: fileDetails });
    });
});

function getContentType(fileName) {
    const fileExtension = path.extname(fileName).toLowerCase();

    switch (fileExtension) {
        case '.pdf':
            return 'pdf';
        case '.png':
            return 'image';
        case '.jpg':
        case '.jpeg':
            return 'image';
        default:
            return 'application/octet-stream';
    }
}

app.get('/all-files', (req, res) => {
    res.sendFile(path.join(__dirname, 'allFiles.html'));
})

app.get('/download', authenticateUser, (req, res) => {
    try {
        const fileName = req.query.fileName;
        const user_id = req.user.email;
        console.log(fileName);

        if (!fileName) {
            return res.status(400).json({ error: 'Missing fileName parameter.' });
        }

        const filePath = path.join(__dirname, 'upload', user_id, fileName);
        console.log(filePath);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found.' });
        }

        const contentType = getContentType(fileName);
        console.log(contentType);


        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });

app.get('/upload-file', (req, res) => {
    res.sendFile(path.join(__dirname, 'uploadFile.html'));
})

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
  });

app.post('/login', upload.none(), (req, res) => {
    const {email, password} = req.body;

    if(!isValidCredentials(email, password)) {
        res.status(400).send("Not valid credentials");
        return;
    }

    const token = generateToken({email, password});

    res.json({ token, ok:true });
})

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'signup.html'));
  });

app.post('/signup', upload.none(), (req, res) => {
    const {email, password} = req.body;

    if(doesUserExist(email)) {
        res.status(400).send("user alreday exists");
        return;
    }

    const newUser = { email, password };
    addUser(newUser);

    const token = generateToken(newUser);

    res.json({ token, ok:true });
})



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
