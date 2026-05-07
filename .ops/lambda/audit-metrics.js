/**
 * AWS Lambda function designed to be the destination for a MongoDB Atlas Database Trigger.
 * 
 * In MongoDB Atlas:
 * 1. Create a Trigger on the "AuditLog" collection.
 * 2. Operation Type: Insert.
 * 3. Match Expression: 
 *    { "fullDocument.event": { "$in": ["OWNERSHIP_VIOLATION", "AUTH_FAILURE"] } }
 * 4. Action: EventBridge or direct API Call to this Lambda API Gateway endpoint.
 */

import { CloudWatchClient, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";

const cloudwatch = new CloudWatchClient({ region: process.env.AWS_REGION || 'ap-south-1' });

export const handler = async (event) => {
  try {
    // Atlas sends the full document in the event payload
    const fullDocument = event.detail?.fullDocument || JSON.parse(event.body)?.fullDocument;
    
    if (!fullDocument || !fullDocument.event) {
      console.log("No event found in payload");
      return { statusCode: 400, body: "Invalid payload" };
    }

    const eventType = fullDocument.event;
    let metricName = "";

    if (eventType === "OWNERSHIP_VIOLATION") {
      metricName = "OwnershipViolationCount";
    } else if (eventType === "AUTH_FAILURE") {
      metricName = "AuthFailureCount";
    } else {
      console.log(`Ignoring event type: ${eventType}`);
      return { statusCode: 200, body: "Ignored" };
    }

    const params = {
      Namespace: 'ExamSystem/Security',
      MetricData: [
        {
          MetricName: metricName,
          Value: 1,
          Unit: 'Count',
          Timestamp: new Date(),
          Dimensions: [
            {
              Name: 'Environment',
              Value: process.env.NODE_ENV || 'Production'
            }
          ]
        }
      ]
    };

    const command = new PutMetricDataCommand(params);
    await cloudwatch.send(command);

    console.log(`Successfully pushed metric ${metricName} to CloudWatch`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Metric ${metricName} pushed successfully` }),
    };

  } catch (error) {
    console.error("Error pushing metric to CloudWatch:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
