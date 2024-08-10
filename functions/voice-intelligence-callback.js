exports.handler = async function (context, event, callback) {
  const { transcript_sid, event_type } = event;

  /** @type {import('twilio').Twilio} */
  const client = context.getTwilioClient();

  if (event_type !== "voice_intelligence_transcript_available")
    return callback(null, {
      success: true,
      data: { message: "Transcript not available yet" },
    });

  try {
    const customOperatorName = {
      name: "Custom Operator",
      phrasesSet: [{ name: "Check Cancel Intention" }],
    };

    const data = await client.intelligence.v2
      .transcripts(transcript_sid)
      .operatorResults.list();

    const customOperator = data.find(
      (operator) => operator.name === customOperatorName.name
    );

    if (!customOperator)
      return callback(null, {
        success: false,
        data: { message: "Custom operator not found" },
      });

    const checkIfOperatorHaveSomeResult = Object.keys(
      customOperator.extractResults
    );

    if (!checkIfOperatorHaveSomeResult.length)
      return callback(null, {
        success: false,
        message: "Custom Operator no extract results",
      });

    const transcriptionInformation = await client.intelligence.v2
      .transcripts(transcript_sid)
      .fetch();

    const customerNumber = transcriptionInformation.channel?.participants?.find(
      (participant) => participant.role === "Customer"
    );

    if (!customerNumber)
      return callback(null, {
        success: false,
        message: "Customer number not found",
      });

    switch (true) {
      case checkIfOperatorHaveSomeResult.includes("check_cancel_intention"): {
        const message = await client.messages.create({
          to: `whatsapp:${customerNumber.media_participant_id}`,
          from: `whatsapp:${context.DEFAULT_FROM_MESSAGE_NUMBER}`,
          messagingServiceSid: context.DEFAULT_MESSAGE_SERVICE_SID,
          contentSid: context.DEFAULT_CANCEL_RETENTION_TEMPLATE_SID,
        });

        return callback(null, {
          success: true,
          data: {
            messageSid: message.sid,
            customerNumber,
            extractedEventFromVI: "check_cancel_intention",
          },
        });
      }

      default: {
        return callback(null, {
          success: false,
          message: "extracted event not mapped ",
        });
      }
    }
  } catch (err) {
    console.log("Error:", err);
    return callback(null, {
      success: false,
      message: err.message,
    });
  }
};
