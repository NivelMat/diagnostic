/**
 * Apps Script para recibir preinscripciones, enviar un código de verificación por correo
 * y validar ese código antes de registrar la inscripción en la hoja.
 */

const SHEET_NAME = 'Hoja 1';
const SECRET_TOKEN = 'qFsPnoyLV8fu51pqbkiRcT84ptajwFsh7y3zveaNsj4LNh2Qmv';
const ALLOWED_ORIGIN = 'https://nivelmat.github.io';
const VERIFICATION_PROPERTY_PREFIX = 'verification_';
const VERIFICATION_EXPIRATION_MS = 15 * 60 * 1000; // 15 minutos

function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
    .setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Sheet-Token');
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: 'No hay datos' }, 400);
    }

    const data = JSON.parse(e.postData.contents);
    if (!validateToken(data.token)) {
      return jsonResponse({ success: false, error: 'Token inválido o ausente' }, 401);
    }

    const action = (data.action || 'submit').toString();
    if (action === 'send_code') {
      return handleSendCode(data);
    }
    if (action === 'verify_code') {
      return handleVerifyCode(data);
    }
    return handleSubmit(data);
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() }, 500);
  }
}

function validateToken(token) {
  return token && token === SECRET_TOKEN;
}

function handleSendCode(data) {
  const correo = (data.correo || '').toString().trim();
  if (!correo) {
    return jsonResponse({ success: false, error: 'Correo es obligatorio' }, 400);
  }

  const codigo = String(Math.floor(100000 + Math.random() * 900000));
  const record = { codigo: codigo, createdAt: Date.now() };
  const props = PropertiesService.getScriptProperties();
  props.setProperty(VERIFICATION_PROPERTY_PREFIX + encodeURIComponent(correo), JSON.stringify(record));

  const asunto = 'Código de verificación NivelMat';
  const mensaje = 'Tu código de verificación es: ' + codigo + '\n\n' +
    'Ingresa este código en el formulario para continuar con la preinscripción.';

  const verification = {
    codigo: codigo,
    createdAt: Date.now(),
    verified: false
  };
  PropertiesService.getScriptProperties().setProperty(
    VERIFICATION_PROPERTY_PREFIX + encodeURIComponent(correo),
    JSON.stringify(verification)
  );

  GmailApp.sendEmail(correo, asunto, mensaje);
  return jsonResponse({ success: true, message: 'Código enviado' });
}

function handleVerifyCode(data) {
  const correo = (data.correo || '').toString().trim();
  const codigo = (data.codigo || '').toString().trim();
  if (!correo || !codigo) {
    return jsonResponse({ success: false, error: 'Correo y código son obligatorios' }, 400);
  }

  const verification = getVerificationRecord(correo);
  if (!verification) {
    return jsonResponse({ success: false, error: 'No se encontró ningún código enviado' }, 400);
  }

  if (Date.now() - verification.createdAt > VERIFICATION_EXPIRATION_MS) {
    deleteVerificationRecord(correo);
    return jsonResponse({ success: false, error: 'El código ha expirado. Solicita uno nuevo.' }, 400);
  }

  if (verification.codigo !== codigo) {
    return jsonResponse({ success: false, error: 'Código incorrecto' }, 400);
  }

  verification.verified = true;
  PropertiesService.getScriptProperties().setProperty(
    VERIFICATION_PROPERTY_PREFIX + encodeURIComponent(correo),
    JSON.stringify(verification)
  );

  return jsonResponse({ success: true, message: 'Código verificado' });
}

function handleSubmit(data) {
  const requiredFields = ['nombres', 'apellidos', 'ci', 'prefijo_ci', 'telefono', 'correo', 'codigo_verificacion'];
  for (let i = 0; i < requiredFields.length; i++) {
    const key = requiredFields[i];
    if (!data[key] || data[key].toString().trim() === '') {
      return jsonResponse({ success: false, error: 'Faltan campos requeridos: ' + key }, 400);
    }
  }

  const verification = getVerificationRecord(data.correo);
  if (!verification || verification.codigo !== data.codigo_verificacion || verification.verified !== true) {
    return jsonResponse({ success: false, error: 'Necesitas verificar el código antes de enviar' }, 400);
  }

  if (Date.now() - verification.createdAt > VERIFICATION_EXPIRATION_MS) {
    deleteVerificationRecord(data.correo);
    return jsonResponse({ success: false, error: 'El código ha expirado. Solicita uno nuevo.' }, 400);
  }

  deleteVerificationRecord(data.correo);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  const lastRow = sheet.getLastRow();
  const nextNumber = Math.max(1, lastRow - 4) + 1;
  const row = [
    nextNumber,
    data.nombres || '',
    data.apellidos || '',
    data.prefijo_ci || '',
    data.ci || '',
    data.telefono || '',
    data.es_bachiller || '',
    (data.es_bachiller === 'si' ? data.colegio : '') || '',
    data.estudia_universidad || '',
    (data.estudia_universidad === 'si' ? data.universidad : '') || '',
    (data.estudia_universidad === 'si' ? data.carrera : '') || '',
    data.telefono || '',
    data.correo || '',
    data.fecha || ''
  ];

  let targetRow = 5;
  if (sheet.getLastRow() >= 5) {
    targetRow = sheet.getLastRow() + 1;
  }
  sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);

  return jsonResponse({ success: true, message: 'Preinscripción registrada' });
}

function getVerificationRecord(correo) {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(VERIFICATION_PROPERTY_PREFIX + encodeURIComponent(correo));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function deleteVerificationRecord(correo) {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(VERIFICATION_PROPERTY_PREFIX + encodeURIComponent(correo));
}

function jsonResponse(obj, status) {
  status = status || 200;
  const out = ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  out.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  out.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  out.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Sheet-Token');
  return out;
}
