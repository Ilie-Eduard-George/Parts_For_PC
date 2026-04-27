const express = require("express");
const path = require("path");
const fs = require("fs");
const sass = require("sass");
const sharp = require("sharp");

const app = express();
app.set("view engine", "ejs");

let obGlobal = {
    obErori: null,
    obImagini: null,
    folderScss: path.join(__dirname, "resurse/scss"),
    folderCss: path.join(__dirname, "resurse/css"),
    folderBackup: path.join(__dirname, "backup"),
};

let vect_foldere = ["temp", "logs", "backup", "fisiere_uploadate"];

for (let folder of vect_foldere) {
    let caleFolder = path.join(__dirname, folder);

    if (!fs.existsSync(caleFolder)) {
        fs.mkdirSync(caleFolder, { recursive: true });
    }
}

console.log("Folder index.js", __dirname);
console.log("Folder curent (de lucru)", process.cwd());
console.log("Cale fisier", __filename);

app.use("/resurse", express.static(path.join(__dirname, "resurse")));
app.use("/dist", express.static(path.join(__dirname, "node_modules/bootstrap/dist")));

app.get("/favicon.ico", function(req, res) {
    res.sendFile(path.join(__dirname, "resurse/imagini/favicon/favicon.ico"));
});

function caleUrl(caleGalerie, ...parti) {
    return "/" + path.posix.join(caleGalerie.replace(/\\/g, "/"), ...parti);
}

function getAnotimpCurent() {
    const luna = new Date().getMonth() + 1;

    if (luna >= 3 && luna <= 5) {
        return "primavara";
    }

    if (luna >= 6 && luna <= 8) {
        return "vara";
    }

    if (luna >= 9 && luna <= 11) {
        return "toamna";
    }

    return "iarna";
}

async function initImagini() {
    let continut = fs.readFileSync(
        path.join(__dirname, "resurse/json/galerie.json")
    ).toString("utf-8");

    obGlobal.obImagini = JSON.parse(continut);

    let vImagini = obGlobal.obImagini.imagini;
    let caleGalerie = obGlobal.obImagini.cale_galerie;

    let caleAbs = path.join(__dirname, caleGalerie);

    let caleAbsMediu = path.join(caleAbs, "mediu");
    let caleAbsMic = path.join(caleAbs, "mic");

    if (!fs.existsSync(caleAbsMediu)) {
        fs.mkdirSync(caleAbsMediu, { recursive: true });
    }

    if (!fs.existsSync(caleAbsMic)) {
        fs.mkdirSync(caleAbsMic, { recursive: true });
    }

    for (let imag of vImagini) {
        let numeFis = path.parse(imag.fisier).name;

        let caleFisAbs = path.join(caleAbs, imag.fisier);

        let numeFisMediu = numeFis + ".webp";
        let numeFisMic = numeFis + ".webp";

        let caleFisMediuAbs = path.join(caleAbsMediu, numeFisMediu);
        let caleFisMicAbs = path.join(caleAbsMic, numeFisMic);

        if (!fs.existsSync(caleFisMediuAbs)) {
            await sharp(caleFisAbs)
                .resize(300)
                .toFile(caleFisMediuAbs);
        }

        if (!fs.existsSync(caleFisMicAbs)) {
            await sharp(caleFisAbs)
                .resize(150)
                .toFile(caleFisMicAbs);
        }

        imag.fisier_original = caleUrl(caleGalerie, imag.fisier);
        imag.fisier_mediu = caleUrl(caleGalerie, "mediu", numeFisMediu);
        imag.fisier_mic = caleUrl(caleGalerie, "mic", numeFisMic);

        if (!imag.alt) {
            imag.alt = numeFis;
        }
    }
}

function initErori() {
    let continut = fs.readFileSync(
        path.join(__dirname, "resurse/json/erori.json")
    ).toString("utf-8");

    let erori = obGlobal.obErori = JSON.parse(continut);

    let err_default = erori.eroare_default;
    err_default.imagine = path.join(erori.cale_baza, err_default.imagine);

    for (let eroare of erori.info_erori) {
        eroare.imagine = path.join(erori.cale_baza, eroare.imagine);
    }
}

initErori();

function afisareEroare(res, identificator, titlu, text, imagine) {
    let eroare = obGlobal.obErori.info_erori.find(function(elem) {
        return elem.identificator == identificator;
    });

    let errDefault = obGlobal.obErori.eroare_default;

    if (eroare?.status) {
        res.status(eroare.identificator);
    }

    res.render("pagini/eroare", {
        imagine: imagine || eroare?.imagine || errDefault.imagine,
        titlu: titlu || eroare?.titlu || errDefault.titlu,
        text: text || eroare?.text || errDefault.text,
    });
}

app.get(["/", "/index", "/home"], async function(req, res) {
    await initImagini();

    const anotimpCurent = getAnotimpCurent();

    const imaginiFiltrate = obGlobal.obImagini.imagini.filter(function(img) {
        return img.anotimp && img.anotimp.includes(anotimpCurent);
    });

    res.render("pagini/index", {
        ip: req.ip,
        imagini: imaginiFiltrate,
        anotimpCurent: anotimpCurent,
    });
});

app.get("/despre", function(req, res) {
    res.render("pagini/despre");
});

app.get("/eroare", function(req, res) {
    afisareEroare(res, 404, "Titlu !!!!");
});

function compileazaScss(caleScss, caleCss) {
    if (!caleCss) {
        let numeFisExt = path.basename(caleScss);
        let numeFis = numeFisExt.split(".")[0];
        caleCss = numeFis + ".css";
    }

    if (!path.isAbsolute(caleScss)) {
        caleScss = path.join(obGlobal.folderScss, caleScss);
    }

    if (!path.isAbsolute(caleCss)) {
        caleCss = path.join(obGlobal.folderCss, caleCss);
    }

    let caleBackup = path.join(obGlobal.folderBackup, "resurse/css");

    if (!fs.existsSync(caleBackup)) {
        fs.mkdirSync(caleBackup, { recursive: true });
    }

    let numeFisCss = path.basename(caleCss);

    if (fs.existsSync(caleCss)) {
        fs.copyFileSync(
            caleCss,
            path.join(obGlobal.folderBackup, "resurse/css", numeFisCss)
        );
    }

    let rez = sass.compile(caleScss, { sourceMap: true });
    fs.writeFileSync(caleCss, rez.css);
}

// La pornirea serverului compilează toate fișierele SCSS
let vFisiere = fs.readdirSync(obGlobal.folderScss);

for (let numeFis of vFisiere) {
    if (path.extname(numeFis) == ".scss") {
        compileazaScss(numeFis);
    }
}

// Recompilează SCSS când se modifică fișierele
fs.watch(obGlobal.folderScss, function(eveniment, numeFis) {
    if (eveniment == "change" || eveniment == "rename") {
        let caleCompleta = path.join(obGlobal.folderScss, numeFis);

        if (fs.existsSync(caleCompleta)) {
            compileazaScss(caleCompleta);
        }
    }
});

app.get("/*pagina", function(req, res) {
    console.log("Cale pagina", req.url);

    if (req.url.startsWith("/resurse") && path.extname(req.url) == "") {
        afisareEroare(res, 403);
        return;
    }

    if (path.extname(req.url) == ".ejs") {
        afisareEroare(res, 400);
        return;
    }

    try {
        res.render("pagini" + req.url, function(err, rezRandare) {
            if (err) {
                if (err.message.includes("Failed to lookup view")) {
                    afisareEroare(res, 404);
                } else {
                    afisareEroare(res);
                }
            } else {
                res.send(rezRandare);
                console.log("Rezultat randare", rezRandare);
            }
        });
    } catch (err) {
        if (err.message.includes("Cannot find module")) {
            afisareEroare(res, 404);
        } else {
            afisareEroare(res);
        }
    }
});

app.listen(8080);
console.log("Serverul a pornit!");