import test from "node:test";
import assert from "node:assert/strict";
import initSqlJs from "sql.js";
import { BACKUP_COLLECTIONS, BACKUP_SCHEMA_VERSION, parseAndValidateBackup, stringifyBackup } from "../lib/backup.ts";
import { detectLegacyDatabase, inspectLegacyDatabase } from "../legacy/dataacc-sqlite.ts";

function backup() {
  const collections=Object.fromEntries(BACKUP_COLLECTIONS.map(name=>[name,[]]));
  collections.warehouses=[{_id:"wh",name:"Main",isSalesDefault:true,createdAt:new Date("2024-01-02T03:04:05Z")}];
  collections.paymentAccounts=[{id:"account-cash",code:"cash",name:"Cash"}];
  collections.products=[{id:"p1",sku:"0001",barcode:"123",stocks:{wh:2},createdAt:new Date("2024-01-02T03:04:05Z")}];
  collections.documents=[{id:"d1",number:"SAL-1",kind:"sale",warehouseId:"wh",paymentMethod:"cash",lines:[{productId:"p1"}]}];
  return {format:"conta-backup",schemaVersion:1,createdAt:new Date().toISOString(),appVersion:"test",encoding:"mongodb-extended-json-v2",collections,counts:Object.fromEntries(BACKUP_COLLECTIONS.map(k=>[k,collections[k].length]))};
}
test("native backup is versioned, complete, secret-free, and preserves BSON dates",()=>{const value=backup(),encoded=stringifyBackup(value);assert.equal(value.schemaVersion,BACKUP_SCHEMA_VERSION);for(const name of BACKUP_COLLECTIONS)assert.ok(name in value.collections);for(const secret of ["MONGODB_URI","SESSION_SECRET","OWNER_PASSWORD_HASH"])assert.equal(encoded.includes(secret),false);const decoded=parseAndValidateBackup(encoded);assert.ok(decoded.collections.products[0].createdAt instanceof Date);});
test("native backup rejects invalid formats, future schemas, duplicate ids and references",()=>{assert.throws(()=>parseAndValidateBackup("{}"),/ليس نسخة/);const future=backup();future.schemaVersion=2;assert.throws(()=>parseAndValidateBackup(stringifyBackup(future)),/أحدث/);const duplicate=backup();duplicate.collections.products.push({...duplicate.collections.products[0]});assert.throws(()=>parseAndValidateBackup(stringifyBackup(duplicate)),/معرف المنتج/);const broken=backup();broken.collections.documents[0].lines[0].productId="missing";assert.throws(()=>parseAndValidateBackup(stringifyBackup(broken)),/منتج غير موجود/);});
test("SQLite detection uses magic and schema preview reads real counts",async()=>{assert.equal(detectLegacyDatabase(new TextEncoder().encode("not sqlite")),false);const SQL=await initSqlJs();const db=new SQL.Database();db.run("CREATE TABLE itemsTB(id INTEGER, title TEXT, code TEXT); INSERT INTO itemsTB VALUES (1,'A','123'),(2,'B','456'); CREATE TABLE storesTB(id INTEGER,title TEXT); INSERT INTO storesTB VALUES(1,'Main'); CREATE TABLE userTB(id INTEGER,password TEXT); INSERT INTO userTB VALUES(1,'secret');");const bytes=db.export();db.close();assert.equal(detectLegacyDatabase(bytes),true);const preview=await inspectLegacyDatabase(bytes);assert.equal(preview.groups.find(x=>x.key==='products').count,2);assert.equal(preview.groups.find(x=>x.key==='warehouses').count,1);assert.equal(preview.groups.find(x=>x.key==='userTB').status,'unsupported');});
