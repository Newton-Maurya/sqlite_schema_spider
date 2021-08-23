const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const sqliteJson = require('sqlite-to-json');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();
const port = process.env.PORT || '1999';
// Middelwares
app.use(express.urlencoded());
app.use(express.json());

// Multer for uploading file on server
const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, 'database');
    },
    filename: (req, file, callback) => {
        callback(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({
    storage: storage
})
// capatilize first word
const fileArr = [];
function capStr(str) {
    var i, frags = str.split('_');
    for (i = 0; i < frags.length; i++) {
        frags[i] = frags[i].charAt(0).toUpperCase() + frags[i].slice(1);
    }
    return frags.join('_');
}
async function Result(file_name_original, file_name) {
    const data = {
        column_name: [
            [
                -1, "*"
            ]
        ],
        column_names_original: [
            [
                -1, "*"
            ]
        ],
        column_name_garbage: ["*"],
        column_types: [],
        db_id: '',
        foreign_keys: [],
        primary_keys: [],
        table_names: [],
        table_names_original: []

    };
    let file = `./database/${file_name}`;
    let db_id = file_name_original
    data.db_id = db_id;
    var db = new sqlite3.Database(file);
    exporter = new sqliteJson({
        client: new sqlite3.Database(file)
    })
    const tableNames = function () {
        return new Promise(function (resolve, reject) {
            var responseObj = {}
            exporter.all((err, all) => {
                if (err) {
                    responseObj = {
                        'error': err
                    };
                    reject(responseObj);
                } else {
                    responseObj = {
                        table_name: Object.keys(all),
                        data: all
                    }
                }
                resolve(responseObj);
                // console.log(responseObj, 'table');
            });
        });
    };

    // Getting Primary Keys
    const primaryKeys = (query) => {
        return (
            new Promise((resolve, reject) => {
                db.all(query, (err, primary_key) => {
                    if (err) {
                        reject(err)
                    }
                    else {
                        resolve(primary_key[0].name)
                    }
                    // console.log(primary_key[0].name, 'primary key');
                });
            })
        );
    };
    // Getting Foreign keys

    const foreignKeys = (query) => {
        return (
            new Promise((resolve, reject) => {
                let foreignArr = []
                db.all(query, (err, foreign_keys) => {
                    if (err) {
                        foreignArr = [...foreign_keys];
                        reject(foreignArr)
                    }
                    else {
                        foreignArr = [...foreign_keys];
                        resolve(foreignArr);
                    }
                    // console.log(foreignArr, 'foreign key');
                });
            })
        );
    };

    let tables_Data = await tableNames();
    let tables = tables_Data.table_name;
    let p_key;
    let foreign_keys;
    var column_info;
    var column_value;
    for (let i = 0; i < tables.length; i++) {
        let query = `SELECT l.name FROM pragma_table_info("${tables[i]}") as l WHERE l.pk = 1;`
        data.table_names.push(tables[i])
        data.table_names_original.push(tables[i]);
        column_info = Object.keys(tables_Data.data[tables[i]][0]);
        column_value = tables_Data.data[tables[i]][0];
        for (let char of column_info) {
            data.column_name.push([i, char.toLowerCase()]);
            data.column_names_original.push([i, capStr(char)]);
            data.column_name_garbage.push(char)
            data.column_types.push(typeof (column_value[char]) === "string" ? "text" : typeof (column_value[char]));
            if (column_info.indexOf(char) === column_info.length - 1) {
                p_key = await primaryKeys(query);
                let primary_key_number = data.column_name_garbage.lastIndexOf(p_key);
                data.primary_keys.push(primary_key_number)
            }
        }
    }
    let foreign_key1 = [];
    let foreign_key2 = [];
    for (let i = 0; i < tables.length; i++) {
        foreign_keys = await foreignKeys(`PRAGMA foreign_key_list(${tables[i]});`);
        for (let m = 0; m < foreign_keys.length; m++) {
            for (let j = 1; j < data.column_name.length; j++) {
                if (data.column_name[j][0] === i && data.column_name[j][1] === foreign_keys[m].from) {
                    foreign_key1.push(j)
                }
            }
            for (let j = 1; j < data.column_name.length; j++) {
                let index = tables.indexOf(foreign_keys[m].table)
                if (data.column_name[j][0] === index && data.column_name[j][1] === foreign_keys[m].to) {
                    foreign_key2.push(j)
                }
            }
        }
    }
    for (let i = 0; i < foreign_key1.length; i++) {
        data.foreign_keys.push([foreign_key1[i], foreign_key2[i]])
    }
    db.close();
    delete data.column_name_garbage;
    console.log(data);
    return data;
}


// Routing
app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, '/index.html'));
});

app.post('/api/json_data', upload.single('file'), async (req, res) => {
    try {
        console.log(req.file);
        fileArr.push(req.file.filename);
        let file_name_original = req.file.originalname;
        let o_f_n = file_name_original.split('.').slice(0, -1).join('.');
        console.log(o_f_n, 'ths is fnsme');
        let file_name = req.file.filename;
        let data = await Result(o_f_n, file_name)
        res.status(200).send(JSON.stringify(data));
        if (fileArr.length > 1) {
            console.log(fileArr);
            let file = `./database/${fileArr[0]}`;
            fs.unlink(file, (err, seccess) => {
                if (err) {
                    console.log(err);
                }
            })
        }
    }

    catch {
        res.status(422).send(JSON.stringify({ error: "Error occurd by server side" }))
    }
})


app.listen(port, () => {
    console.log("Application running on port 1999 !");
});



