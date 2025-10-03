# ServiceNow Developer Instance Setup

## Step 1: Sign Up for Developer Account

1. Go to: **https://developer.servicenow.com**
2. Click **"Sign up and Start Building"**
3. Fill in details:
   - Email: `levi.lonic@gmail.com`
   - First/Last Name
   - Company: LonicFLex (or your company)
4. Verify email
5. Log in

## Step 2: Request Personal Developer Instance (PDI)

1. After login, click **"Request Instance"** or go to **"Manage" → "Instance"**
2. Select **"Personal Developer Instance"**
3. Choose ServiceNow release (Latest is fine - "Vancouver" or "Washington DC")
4. Click **"Request"**

## Step 3: Wait for Provisioning (~5-10 minutes)

You'll see:
- Status: "Requested" → "Provisioning" → "Active"
- **DO NOT refresh constantly** - it takes time
- Check email for notification when ready

## Step 4: Get Your Credentials

Once provisioned, you'll receive email with:
- **Instance URL**: `https://devXXXXXX.service-now.com` (where XXXXXX is your instance number)
- **Username**: `admin`
- **Password**: (in the email - SAVE THIS!)

## Step 5: Test Access

1. Go to your instance URL
2. Log in with admin credentials
3. You should see ServiceNow dashboard

## Step 6: What to Give Me

Once you have the instance:
1. **Instance URL**: `https://devXXXXXX.service-now.com`
2. **Username**: `admin` (default)
3. **Password**: (from email)

---

## Important Notes

- **Instance sleeps after 10 days of inactivity** - just wake it up from developer portal
- **Instance URL format**: Always `https://devXXXXXX.service-now.com`
- **Don't lose the password** - you'll need to reset through portal if lost
- **Free for developers** - no credit card needed

---

## Troubleshooting

**"No instances available"**: ServiceNow limits free instances. Try:
- Different email
- Wait 24 hours and try again
- Use company email if available

**"Provisioning taking too long"**:
- Normal: 5-10 minutes
- If > 20 minutes, check developer portal status
- Email support@servicenow.com if stuck

---

**Start here**: https://developer.servicenow.com
