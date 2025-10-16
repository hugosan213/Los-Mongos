/* ARCHIVO SOLO PARA HACER HASH DE LAS CONTRASEÑAS, 
HAY QUE HACERLO PARA AGREGARLO A LA BASE DE DATOS 
EJECUTAR POR TERMINAL NODE HASH.JS CON LA CONTRASEÑA A HASHEAR
Y COPIAR LO QUE SALE EN LA BD*/
 

const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('123456', 10); // Cambia '123456' por la contraseña que quieras hashear
console.log(hash);
