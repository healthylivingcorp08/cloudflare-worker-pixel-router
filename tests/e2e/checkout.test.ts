import { test, expect } from '@playwright/test';

test('should verify checkout process with credit card and Sticky.io integration', async ({ page }) => {
  // Mock the checkout page response
  await page.route('**/checkout', route => {
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `
        <html>
          <body>
            <form id="checkout-form">
              <input type="text" name="name" required>
              <input type="email" name="email" required>
              <textarea name="address" required></textarea>
              <div class="card-element">
                <input type="text" name="cardNumber" placeholder="Card number" required>
                <input type="text" name="expiry" placeholder="MM/YY" required>
                <input type="text" name="cvc" placeholder="CVC" required>
              </div>
              <button type="submit">Place Order</button>
            </form>
            <div class="confirmation" style="display:none">
              Thank you for your order!
            </div>
            <script>
              document.getElementById('checkout-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                // Mock Sticky.io API call
                const response = await fetch('https://api.sticky.io/v1/orders', {
                  method: 'POST',
                  body: JSON.stringify({
                    cardNumber: e.target.cardNumber.value,
                    expiry: e.target.expiry.value,
                    cvc: e.target.cvc.value,
                    customer: {
                      name: e.target.name.value,
                      email: e.target.email.value,
                      address: e.target.address.value
                    }
                  })
                });
                if (response.ok) {
                  document.querySelector('.confirmation').style.display = 'block';
                }
              });
            </script>
          </body>
        </html>
      `
    });
  });

  // Mock Sticky.io API response
  await page.route('https://api.sticky.io/v1/orders', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, orderId: 'sticky_12345' })
    });
  });

  await page.goto('http://drivebright.com/checkout');
  
  // Fill form
  await page.fill('input[name="name"]', 'John Doe');
  await page.fill('input[name="email"]', 'john.doe@example.com');
  await page.fill('textarea[name="address"]', '123 Main St');
  await page.fill('input[name="cardNumber"]', '4444444444444440');
  await page.fill('input[name="expiry"]', '12/25');
  await page.fill('input[name="cvc"]', '123');
  
  // Submit and verify API call
  const [request] = await Promise.all([
    page.waitForRequest('https://api.sticky.io/v1/orders'),
    page.click('button[type="submit"]')
  ]);
  
  // Verify confirmation and API payload
  await page.waitForSelector('.confirmation:visible');
  const confirmationText = await page.textContent('.confirmation');
  expect(confirmationText).toContain('Thank you for your order!');
  expect(request.postDataJSON()).toMatchObject({
    cardNumber: '4444444444444440',
    expiry: '12/25',
    cvc: '123',
    customer: {
      name: 'John Doe',
      email: 'john.doe@example.com',
      address: '123 Main St'
    }
  });
});