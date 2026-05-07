# External Uptime Monitoring Guide

While AWS CloudWatch monitors internal EC2 metrics (CPU, 5xx rates), it cannot detect external failures such as DNS resolution issues, SSL certificate expiration, or AWS region-wide networking outages.

Before the pilot exam, set up an external monitor using a free tier service like **UptimeRobot** or **Better Uptime**.

## Setup Instructions

1. **Create an Account**: Go to uptimerobot.com and sign up.
2. **Add a Monitor**:
   - **Monitor Type**: HTTP(s)
   - **URL**: `https://<YOUR_EXAM_PORTAL_DOMAIN>/` (or the `/api/v1/time` health check endpoint)
   - **Monitoring Interval**: 1 minute (or 5 minutes on the free tier).
   - **Timeout**: 30 seconds.
3. **Alert Contacts**:
   - Add the System Owner's email.
   - For exam days, configure the SMS/Call integration to alert the System Owner immediately.
4. **Failure Thresholds**:
   - Configure it to alert on any `4xx` or `5xx` status code, or if the connection times out.

This external monitor ensures you catch "invisible" failures before the students start complaining.
