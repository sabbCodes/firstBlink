import fetch from 'node-fetch';
import {
  ActionPostResponse,
  ACTIONS_CORS_HEADERS,
  createPostResponse,
  ActionGetResponse,
  ActionPostRequest,
} from "@solana/actions";
import {
  clusterApiUrl,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

const DEFAULT_SOL_ADDRESS: PublicKey = new PublicKey(
  "Sab5y7LG3VefLz4E6DSCkxdmjG4pve3hcAb8NUPKn42",
);

let DEFAULT_SOL_AMOUNT: number = 0.00655;

interface CoinGeckoResponse {
  solana: {
    usd: number;
  };
}

const getSolPriceInUSD = async (): Promise<number> => {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const data = await response.json() as CoinGeckoResponse;
    return data.solana.usd;
  } catch (error) {
    console.error('Error fetching SOL price:', error);
    throw new Error('Unable to fetch SOL price');
  }
};

const setDefaultSolAmount = async () => {
  const solPriceInUSD = await getSolPriceInUSD();
  DEFAULT_SOL_AMOUNT = 1 / solPriceInUSD;
  console.log('Updated DEFAULT_SOL_AMOUNT to:', DEFAULT_SOL_AMOUNT);
};

setDefaultSolAmount();

export const GET = async (req: Request) => {
  await setDefaultSolAmount(); // Ensure the default amount is updated before handling the request
  try {
    const requestUrl = new URL(req.url);
    const { toPubkey } = validatedQueryParams(requestUrl);

    const payload: ActionGetResponse = {
      title: "Content Tipping - Send Tips",
      icon: "https://solana.com/_next/static/media/logotype.e4df684f.svg",
      description: "Tip your favorite content creators with SOL",
      label: "Tip Now",
    };

    return new Response(JSON.stringify(payload), {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Content-Encoding, Accept-Encoding',
      },
    });
  } catch (err) {
    console.error("GET error:", err);
    let message = "An unknown error occurred";
    if (typeof err === "string") message = err;
    return new Response(message, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Content-Encoding, Accept-Encoding',
      },
    });
  }
};

export const OPTIONS = GET;

export const POST = async (req: Request) => {
  await setDefaultSolAmount(); // Ensure the default amount is updated before handling the request
  try {
    const requestUrl = new URL(req.url);
    const { amount, toPubkey } = validatedQueryParams(requestUrl);

    const body: ActionPostRequest = await req.json();
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    let account: PublicKey;
    try {
      account = new PublicKey(body.account);
      console.log("Parsed account public key:", account.toBase58());
    } catch (err) {
      console.error('Invalid "account" provided:', body.account, err);
      return new Response('Invalid "account" provided', {
        status: 400,
        headers: ACTIONS_CORS_HEADERS,
      });
    }

    const connection = new Connection(clusterApiUrl("devnet"));

    const lamports = Math.round(amount * LAMPORTS_PER_SOL);

    const transferSolInstruction = SystemProgram.transfer({
      fromPubkey: account,
      toPubkey: toPubkey,
      lamports,
    });

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash({commitment: "finalized"});

    const transaction = new Transaction({
      feePayer: account,
      blockhash,
      lastValidBlockHeight,
    }).add(transferSolInstruction);

    const payload: ActionPostResponse = await createPostResponse({
      fields: {
        transaction,
        message: `Send ${amount} SOL to ${toPubkey.toBase58()}`,
      },
    });

    return new Response(JSON.stringify(payload), {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Content-Encoding, Accept-Encoding',
      },
    });
  } catch (err) {
    console.error("POST error:", err);
    let message = "An unknown error occurred";
    if (typeof err === "string") message = err;
    return new Response(message, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Content-Encoding, Accept-Encoding',
      },
    });
  }
};

function validatedQueryParams(requestUrl: URL) {
  let toPubkey: PublicKey = DEFAULT_SOL_ADDRESS;
  let amount: number = DEFAULT_SOL_AMOUNT;

  try {
    if (requestUrl.searchParams.get("to")) {
      toPubkey = new PublicKey(requestUrl.searchParams.get("to")!);
    }
  } catch (err) {
    console.error("Invalid input query parameter: to", err);
    throw "Invalid input query parameter: to";
  }

  try {
    if (requestUrl.searchParams.get("amount")) {
      amount = parseFloat(requestUrl.searchParams.get("amount")!);
    }

    if (amount <= 0) throw "amount is too small";
  } catch (err) {
    console.error("Invalid input query parameter: amount", err);
    throw "Invalid input query parameter: amount";
  }

  return {
    amount,
    toPubkey,
  };
}
