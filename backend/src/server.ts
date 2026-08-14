import 'dotenv/config';
import { app } from './app.js';
 
const port = process.env.PORT;
 
if (!port) {
  throw new Error('PORT is not set. Add PORT to your .env file — see .env.example.');
}
 
app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});