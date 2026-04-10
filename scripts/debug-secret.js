console.log('NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET);
console.log('Default fallback:', 'TradeERP_Dev_Secret_Key_2026');
const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'TradeERP_Dev_Secret_Key_2026');
console.log('SECRET length:', SECRET.length);
console.log('SECRET bytes:', Array.from(SECRET));
