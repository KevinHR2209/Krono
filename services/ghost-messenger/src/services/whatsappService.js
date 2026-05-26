const axios = require('axios');

async function sendWhatsAppMessage(phone, message) {
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (nodeEnv === 'development') {
    console.log('----------------------------------------');
    console.log(`📲 WHATSAPP DEV -> ${phone}`);
    console.log(message);
    console.log('----------------------------------------');

    return {
      success: true,
      messageId: `dev-${Date.now()}`,
      deliveredAt: new Date().toISOString(),
      mode: 'development'
    };
  }

  try {
    const response = await axios.post(
      process.env.WHATSAPP_API_URL,
      {
        to: phone,
        text: { body: message }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    return {
      success: true,
      messageId: response.data?.id || null,
      deliveredAt: new Date().toISOString(),
      mode: 'production'
    };
  } catch (error) {
    console.error('❌ WhatsApp API Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message,
      mode: 'production'
    };
  }
}

module.exports = {
  sendWhatsAppMessage
};