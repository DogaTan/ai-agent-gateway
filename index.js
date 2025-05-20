require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

async function analyzeIntent(userMessage) {
  const payload = {
    model: "mistral",
    prompt: `Extract intent and parameters from this message.
Supported intents: query_bill, query_bill_detailed, make_payment, bill_history.
Expected format: intent=<intent_name>;subscriberNo=<value>;month=<value>;year=<value>;amount=<value>

Message: "${userMessage}"`,
    stream: false,
  };

  try {
    const response = await axios.post(
      "http://localhost:11434/api/generate",
      payload
    );
    const reply = response.data.response.trim();
    console.log("Ollama Response:", reply);

    if (!reply.startsWith("intent=")) {
      console.error("Invalid intent format:", reply);
      return "intent=invalid";
    }

    return reply;
  } catch (error) {
    console.error("Ollama API error:", error.message);
    throw error;
  }
}

app.get("/health", (req, res) => {
  res.send("API Gateway is running.");
});

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  const token = req.headers.authorization; // ✅ frontendden gelen token
  console.log("Received message:", userMessage);

  try {
    const intentResponse = await analyzeIntent(userMessage);
    const apiRawResponse = await callMidtermApi(intentResponse, token); // ✅ token'ı gönder

    let formattedResponse = generateUserFriendlyMessage(
      intentResponse,
      apiRawResponse
    );

    res.json({
      message: userMessage,
      extractedIntent: intentResponse,
      userFriendlyResponse: formattedResponse,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Intent analysis or API call failed." });
  }
});

function generateUserFriendlyMessage(intentResponse, apiRawResponse) {
  const intentParts = intentResponse.split(";").map((p) => p.trim());
  const intent = intentParts[0].split("=")[1];
  const subscriberNo = intentParts[1]?.split("=")[1];
  const month = intentParts[2]?.split("=")[1];
  const year = intentParts[3]?.split("=")[1];

  console.log("API Raw Response (as string):", apiRawResponse);

  let parsedResponse;
  try {
    parsedResponse = JSON.parse(apiRawResponse);
    console.log(
      "Parsed Response (as JSON object):",
      JSON.stringify(parsedResponse, null, 2)
    );
  } catch {
    console.log("⚠️ Response is not valid JSON, returning raw.");
    return apiRawResponse;
  }

  const monthMap = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
  };
  const monthNames = [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  let monthNum = monthMap[month?.toLowerCase()] || parseInt(month);
  let monthLabel = monthNames[monthNum] || month;

  const dueDate = calculateDueDate(monthNum, year);

  if (intent === "invalid") {
    return "⚠️ I couldn't understand your request. Please try again with a clear question.";
  }

  if (intent === "query_bill") {
    if (
      !parsedResponse ||
      parsedResponse.noData ||
      parsedResponse.totalAmount === undefined
    ) {
      return `No bill found for subscriber ${subscriberNo} for ${monthLabel} ${year}.`;
    }
    return `Bill Summary:
----------------------------
Subscriber:       ${subscriberNo}
Month:            ${monthLabel} ${year}
Amount Due:       $${parsedResponse.totalAmount?.toFixed(2) || "N/A"}
Due Date:         ${dueDate}
----------------------------
Would you like to see the detailed bill or proceed with payment?`;
  }

  if (intent === "query_bill_detailed") {
    const targetYear = parseInt(year);
    const targetMonth = monthMap[month?.toLowerCase()] || parseInt(month);

    if (
      !parsedResponse.content ||
      !Array.isArray(parsedResponse.content) ||
      parsedResponse.content.length === 0 ||
      parsedResponse.noData
    ) {
      return `No bill found for subscriber ${subscriberNo} for ${monthLabel} ${year}.`;
    }

    const detailedContent = parsedResponse.content.find((item) => {
      const itemSubNo = item.subscriber?.subscriberNo?.toString();
      return (
        itemSubNo === subscriberNo &&
        item.month === targetMonth &&
        item.year === targetYear
      );
    });

    if (!detailedContent) {
      return `No bill found for subscriber ${subscriberNo} for ${monthLabel} ${year}.`;
    }

    const basePlan = 50;
    const usageCharge = detailedContent.totalAmount - basePlan;
    const dueDateFormatted = calculateDueDate(targetMonth, year);

    return `Bill Details for ${monthLabel} ${year}:
----------------------------
Base Plan:             $${basePlan.toFixed(2)}
Data Usage:            ${detailedContent.totalMb} MB
Minutes Usage:         ${detailedContent.totalMinutes} minutes
Data & Minutes Charge: $${usageCharge.toFixed(2)}
Total Due:             $${detailedContent.totalAmount.toFixed(2)}
Due Date:              ${dueDateFormatted}
----------------------------
Would you like to proceed with payment?`;
  }

  if (intent === "make_payment") {
    if (
      !parsedResponse ||
      parsedResponse.noData ||
      parsedResponse.totalAmount === undefined
    ) {
      return `No bill found for subscriber ${subscriberNo} for ${monthLabel} ${year}. Payment could not be processed.`;
    }

    const amountPart = intentParts.find((p) => p.startsWith("amount="));
    const amountPaidNow = amountPart ? parseFloat(amountPart.split("=")[1]) : 0;

    const totalBill = parsedResponse.totalAmount || 0;
    const previouslyPaid = parsedResponse.paidAmount || 0;
    const totalPaid = previouslyPaid + amountPaidNow;
    const remainingBalance = totalBill - totalPaid;

    return `✅ Payment successful!

Payment Summary:
----------------------------
Subscriber:        ${subscriberNo}
Month:             ${monthLabel} ${year}
Total Bill:        $${totalBill.toFixed(2)}
Previously Paid:   $${previouslyPaid.toFixed(2)}
Amount Paid Now:   $${amountPaidNow.toFixed(2)}
Total Paid:        $${totalPaid.toFixed(2)}
Remaining Balance: $${remainingBalance.toFixed(2)}
----------------------------
Thank you for your payment!`;
  }

  if (intent === "bill_history") {
    let parsedList = Array.isArray(parsedResponse)
      ? parsedResponse
      : parsedResponse.content || [];
    if (!parsedList.length) {
      return `No bill history found for subscriber ${subscriberNo}.`;
    }

    const historyLines = parsedList
      .map((item) => {
        const monthLabelHistory = monthNames[item.month];
        return `- ${monthLabelHistory} ${item.year}  | Amount Due: $${
          item.totalAmount
        } | Paid: ${item.isPaid ? "Yes" : "No"}`;
      })
      .join("\n");

    return `Bill History for Subscriber ${subscriberNo}:
${historyLines}`;
  }

  return "Sorry, I could not process your request.";
}

function calculateDueDate(monthNumber, year) {
  const monthNames = [
    "",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  let nextMonth = parseInt(monthNumber) + 1;
  let nextYear = parseInt(year);

  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear++;
  }

  const monthName = monthNames[nextMonth];
  return `${monthName} 10, ${nextYear}`;
}

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const response = await axios.post(
      "https://se4458-midterm-project.onrender.com/api/v1/auth/login",
      null, // Body yok, çünkü bu API query param ile çalışıyor
      {
        params: { username, password },
      }
    );

    res.status(200).json({ token: response.data.token });
  } catch (error) {
    console.error("Login failed:", error.response?.data || error.message);
    res
      .status(error.response?.status || 500)
      .json({ error: error.response?.data?.error || "Login failed" });
  }
});

app.listen(PORT, () => {
  console.log(`API Gateway listening on port ${PORT}`);
});

async function callMidtermApi(intentDataString, userToken) {
  const monthMap = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
  };
  const intentParts = intentDataString.split(";").map((p) => p.trim());
  const intent = intentParts[0].split("=")[1];

  if (intent === "invalid") {
    return "⚠️ I couldn't understand your request. Please try again with a clear question.";
  }

  const subscriberNo = intentParts[1]?.split("=")[1];
  let rawMonth = intentParts[2]?.split("=")[1];
  let month = monthMap[rawMonth?.toLowerCase()] || rawMonth;
  const year = intentParts[3]?.split("=")[1];

  let apiUrl = "";
  let method = "get";
  let data = null;

  if (intent === "query_bill") {
    apiUrl = `https://se4458-midterm-project.onrender.com/api/v1/bill/calculate?subscriberNo=${subscriberNo}&month=${month}&year=${year}`;
  } else if (intent === "query_bill_detailed") {
    apiUrl = `https://se4458-midterm-project.onrender.com/api/v1/bill/detailed?subscriberNo=${subscriberNo}&month=${month}&year=${year}`;
  } else if (intent === "make_payment") {
    const amountPart = intentParts.find((p) => p.startsWith("amount="));
    const amount = amountPart ? amountPart.split("=")[1] : 0;
    apiUrl = `https://se4458-midterm-project.onrender.com/api/v1/bill/pay?subscriberNo=${subscriberNo}&month=${month}&year=${year}&amount=${amount}`;
    method = "post";
  } else if (intent === "bill_history") {
    apiUrl = `https://se4458-midterm-project.onrender.com/api/v1/bill/history?subscriberNo=${subscriberNo}`;
  } else {
    return `Unsupported intent: ${intent}`;
  }

  try {
    const config = {
      method: method,
      url: apiUrl,
      headers: {
        Authorization: userToken || "", // ✅ Doğru kullanım
        "Content-Type": "application/json",
      },
      data: data,
    };
    const response = await axios(config);
    return JSON.stringify(response.data);
  } catch (error) {
    console.error("Midterm API error:", error.message);

    if (error.response && error.response.status === 409) {
      console.log(
        `✅ Midterm API returned 409 Conflict - No data found for intent: ${intent}`
      );
      return JSON.stringify({ noData: true });
    }

    if (error.response) {
      console.log(`⚠️ Midterm API returned status ${error.response.status}`);
    } else {
      console.log("⚠️ No response received from Midterm API.");
    }

    return JSON.stringify({ noData: true });
  }
}
