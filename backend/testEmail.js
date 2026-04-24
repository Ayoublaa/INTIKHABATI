// Test rapide email — node testEmail.js
require('dotenv').config();
const { sendRegistrationConfirmation, sendMilitaryAlert } = require('./services/emailService');

async function main() {
  console.log('📧 EMAIL_USER :', process.env.EMAIL_USER);
  console.log('📧 ADMIN_EMAIL:', process.env.ADMIN_EMAIL);
  console.log('📧 EMAIL_PASS :', process.env.EMAIL_PASS ? '✅ défini' : '❌ VIDE');
  console.log('');

  // Test 1 — Email de confirmation inscription
  console.log('🔄 Test 1 : Envoi email confirmation...');
  try {
    await sendRegistrationConfirmation(
      process.env.ADMIN_EMAIL,          // envoyer à toi-même pour tester
      'Ahmed Benali (TEST)',
      'Casablanca',
      '0xabc123testTXhash456def'
    );
    console.log('✅ Test 1 OK — email confirmation envoyé !');
  } catch (e) {
    console.error('❌ Test 1 FAILED:', e.message);
  }

  console.log('');

  // Test 2 — Alerte militaire
  console.log('🔄 Test 2 : Envoi alerte militaire...');
  try {
    await sendMilitaryAlert(
      '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
      '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
      'Militaire (TEST)',
      'Rabat'
    );
    console.log('✅ Test 2 OK — alerte militaire envoyée !');
  } catch (e) {
    console.error('❌ Test 2 FAILED:', e.message);
  }

  console.log('\n🏁 Tests terminés.');
  process.exit(0);
}

main();
