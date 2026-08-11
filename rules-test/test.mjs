import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where } from 'firebase/firestore';

const rules = readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8');

const testEnv = await initializeTestEnvironment({
  projectId: 'gymtrack-rules-test',
  firestore: { rules, host: '127.0.0.1', port: 8080 },
});

let pass = 0, fail = 0;
async function check(label, promise, expectSuccess) {
  try {
    await promise;
    if (expectSuccess) { console.log('OK  ', label); pass++; }
    else { console.log('FAIL', label, '(se esperaba que fallara, pero pasó)'); fail++; }
  } catch (e) {
    if (!expectSuccess) { console.log('OK  ', label); pass++; }
    else { console.log('FAIL', label, '(se esperaba que pasara, pero falló:', e.message.split('\n')[0], ')'); fail++; }
  }
}

// Seed data as admin (bypassing rules) to set up scenario
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'usuarios', 'uidA'), { email: 'gymA@test.com', uid: 'uidA', plan: 'sencillo', funciones: ['dashboard'], pinFinanzas: 'hash-a' });
  await setDoc(doc(db, 'usuarios', 'uidB'), { email: 'gymB@test.com', uid: 'uidB', plan: 'pro', funciones: ['dashboard'], pinFinanzas: 'hash-b' });
  await setDoc(doc(db, 'usuarios', 'uidA', 'miembros', 'm1'), { nombre: 'Juan' });
  await setDoc(doc(db, 'usuarios', 'uidB', 'miembros', 'm2'), { nombre: 'Pedro' });
  await setDoc(doc(db, 'usuarios', 'pending_gymC_test_com'), { email: 'gymC@test.com', plan: 'pro', funciones: ['dashboard'], pendiente: true });
});

const gymA = testEnv.authenticatedContext('uidA', { email: 'gymA@test.com' }).firestore();
const gymB = testEnv.authenticatedContext('uidB', { email: 'gymB@test.com' }).firestore();
const gymC = testEnv.authenticatedContext('uidC', { email: 'gymC@test.com' }).firestore(); // aún no migrado
const admin = testEnv.authenticatedContext('adminUid', { email: 'luismolinac06@gmail.com' }).firestore();
const anon = testEnv.unauthenticatedContext().firestore();

console.log('\n--- Aislamiento entre gimnasios (lo más importante) ---');
await check('Gym A puede leer su propio doc', getDoc(doc(gymA, 'usuarios', 'uidA')), true);
await check('Gym A NO puede leer el doc de Gym B', getDoc(doc(gymB, 'usuarios', 'uidA')), false);
await check('Gym A NO puede leer miembros de Gym B', getDoc(doc(gymA, 'usuarios', 'uidB', 'miembros', 'm2')), false);
await check('Gym A puede leer sus propios miembros', getDoc(doc(gymA, 'usuarios', 'uidA', 'miembros', 'm1')), true);
await check('Gym A NO puede escribir en Gym B', updateDoc(doc(gymA, 'usuarios', 'uidB'), { plan: 'premium' }), false);
await check('Gym A NO puede borrar miembros de Gym B', deleteDoc(doc(gymA, 'usuarios', 'uidB', 'miembros', 'm2')), false);
// Firestore NO filtra un list() doc por doc: si la regla depende de resource.data
// (como ownsByEmail()) y la query no trae un where() que la acote, Firestore
// rechaza la petición completa (no la recorta). Por eso esto debe FALLAR entero.
await check('Gym A NO puede listar toda la colección usuarios sin filtro (Firestore rechaza la query completa)', getDocs(collection(gymA, 'usuarios')), false);
// El patrón que sí usa index.html (loadPlan): acotar con where() para que Firestore
// pueda verificar la regla contra el resultado de la query, no contra toda la colección.
await check('Gym A puede listar usuarios filtrando por su propio email (y no ve el de B)', (async()=>{
  const q = query(collection(gymA, 'usuarios'), where('email','==','gymA@test.com'));
  const snap = await getDocs(q);
  const ids = snap.docs.map(d=>d.id);
  if (!ids.includes('uidA')) throw new Error('no encontró su propio doc');
  if (ids.includes('uidB')) throw new Error('vio el doc de otro gimnasio');
})(), true);

console.log('\n--- Acceso admin ---');
await check('Admin puede leer doc de Gym A', getDoc(doc(admin, 'usuarios', 'uidA')), true);
await check('Admin puede leer doc de Gym B', getDoc(doc(admin, 'usuarios', 'uidB')), true);
await check('Admin puede cambiar el plan de Gym A', updateDoc(doc(admin, 'usuarios', 'uidA'), { plan: 'premium' }), true);
await check('Admin puede listar todos los usuarios', (async()=>{
  const snap = await getDocs(collection(admin, 'usuarios'));
  if (snap.size < 2) throw new Error('no vio todos los docs');
})(), true);
await check('Admin puede borrar un cliente', deleteDoc(doc(admin, 'usuarios', 'uidB', 'miembros', 'm2')), true);

console.log('\n--- Usuario no autenticado ---');
await check('Anónimo NO puede leer nada', getDoc(doc(anon, 'usuarios', 'uidA')), false);

console.log('\n--- Flujo de migración pending_ -> uid real ---');
await check('Gym C (nuevo) puede encontrar su doc pending_ por email', (async()=>{
  const q = query(collection(gymC, 'usuarios'), where('email','==','gymC@test.com'));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('no encontró su pending_');
})(), true);
await check('Gym C puede crear su doc real con su propio uid', setDoc(doc(gymC, 'usuarios', 'uidC'), { email: 'gymC@test.com', uid: 'uidC', plan: 'pro', funciones: ['dashboard'], pendiente: false }), true);
await check('Gym C puede borrar su propio pending_ tras migrar', deleteDoc(doc(gymC, 'usuarios', 'pending_gymC_test_com')), true);
await check('Gym A NO puede borrar el pending_ de otro (ya migrado, pero probamos con uno nuevo)', (async()=>{
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'usuarios', 'pending_gymD_test_com'), { email: 'gymD@test.com', plan:'sencillo' });
  });
  await deleteDoc(doc(gymA, 'usuarios', 'pending_gymD_test_com'));
})(), false);

console.log('\n--- Límite conocido: auto-elevación de plan ---');
await check('(esperado que PASE hoy) Gym A puede reescribir su propio plan/funciones', updateDoc(doc(gymA, 'usuarios', 'uidA'), { plan: 'premium', funciones: ['dashboard','finanzas','empleados'] }), true);

console.log(`\n=== ${pass} OK / ${fail} FAIL ===`);
await testEnv.cleanup();
process.exit(fail > 0 ? 1 : 0);
