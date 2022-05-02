import {
    Account,
    Keypair,
    Connection,
    PublicKey,
    LAMPORTS_PER_SOL,
    SystemProgram,
    TransactionInstruction,
    Transaction,
    sendAndConfirmTransaction,
} from '@solana/web3.js';
import { MintLayout, AccountLayout, Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import fs from 'mz/fs';
import path from 'path';
import * as borsh from 'borsh';

import {getPayer, getRpcUrl, createKeypairFromFile} from './utils';

/**
 * Connection to the network
 */
let connection: Connection;

/**
 * Keypair associated to the fees' payer
 */
let payer: Keypair;

/**
 * Hello world's program id
 */
let programId: PublicKey;

/**
 * The public key of the account tracking the mint index
 */
let indexPubkey: PublicKey;

let indexAccount;

/**
 * Path to program files
 */
const PROGRAM_PATH = path.resolve(__dirname, '../../dist/program');

/**
 * Path to program shared object file which should be deployed on chain.
 * This file is created when running either:
 *     - `npm run build:program-c`
 *     - `npm run build:program-rust`
 */
const PROGRAM_SO_PATH = path.join(PROGRAM_PATH, 'test.so');

const PROGRAM_KEYPAIR_PATH = path.join(PROGRAM_PATH, 'amoebit_minter-keypair.json');

class AmoebitIndexAccount {
    buyer_address = new PublicKey("Acz3XbJH63t232xMy8t6jw3soq7gCDUZqHe5io7Y7b1a");
    amount_token = 0;
    constructor(fields: {amount_token: number} | undefined = undefined) {
        if (fields) {
            this.amount_token = fields.amount_token;
        }
    }
}

const AmoebitIndexSchema = new Map([
    [AmoebitIndexAccount, {kind: 'struct', fields: [['amount_token', 'u64']]}],
]);

const INDEX_SIZE = borsh.serialize(
    AmoebitIndexSchema,
    new AmoebitIndexAccount(),
).length;

export async function establishConnection(): Promise<void> {
    const rpcUrl = await getRpcUrl();
    connection = new Connection(rpcUrl, 'confirmed');
    const version = await connection.getVersion();
    console.log('Connection to cluster established:', rpcUrl, version);
}

export async function establishPayer(): Promise<void> {
    let fees = 0;
    if (!payer) {
        const {feeCalculator} = await connection.getRecentBlockhash();

        // Calculate the cost to fund the index account
        fees += await connection.getMinimumBalanceForRentExemption(INDEX_SIZE);

        // Calculate the cost of sending transactions
        fees += feeCalculator.lamportsPerSignature * 100; // wag

        payer = await getPayer();
    }

    let lamports = await connection.getBalance(payer.publicKey);
    if (lamports < fees) {
        // If current balance is not enough to pay for fees, request an airdrop
        const sig = await connection.requestAirdrop(
            payer.publicKey,
            fees - lamports,
        );
        await connection.confirmTransaction(sig);
        lamports = await connection.getBalance(payer.publicKey);
    }

    console.log(
        'Using account',
        payer.publicKey.toBase58(),
        'containing',
        lamports / LAMPORTS_PER_SOL,
        'SOL to pay for fees',
    );
}

/**
 * Make sure the accounts for the program are available
 */
export async function checkAccounts(): Promise<void> {
    // Read program id from keypair file
    const programKeypair = await createKeypairFromFile(PROGRAM_KEYPAIR_PATH);
    programId = programKeypair.publicKey;

    // Check if the program has been deployed
    const programInfo = await connection.getAccountInfo(programId);
    if (programInfo === null) {
        if (fs.existsSync(PROGRAM_SO_PATH)) {
            throw new Error(
                'Program needs to be deployed with `solana program deploy dist/program/test.so`',
            );
        } else {
            throw new Error('Program needs to be built and deployed');
        }
    } else if (!programInfo.executable) {
        throw new Error(`Program is not executable`);
    }
    console.log(`Using program ${programId.toBase58()}`);

    // Derive the address (public key) of the account from the program so that it's easy to find later.
    const INDEX_SEED = 'Acz3XbJH63t232xMy8t6';
    indexPubkey = await PublicKey.createWithSeed(
        payer.publicKey,
        INDEX_SEED,
        programId,
    );

    // Check if the account has already been created
    indexAccount = await connection.getAccountInfo(indexPubkey);
    if (indexAccount === null) {
        console.log(
            'Creating account',
            indexPubkey.toBase58(),
            'to count mint index',
        );
        const lamports = await connection.getMinimumBalanceForRentExemption(
            INDEX_SIZE,
        );


        const transaction = new Transaction().add(
            SystemProgram.createAccountWithSeed({
                basePubkey: payer.publicKey,
                fromPubkey: payer.publicKey,
                lamports,
                newAccountPubkey: indexPubkey,
                programId: programId,
                seed: INDEX_SEED,
                space: INDEX_SIZE,
            }),
        );
        await sendAndConfirmTransaction(connection, transaction, [payer]);
    }
}

export async function testContract(testAmount: String): Promise<void> {
    let
    minter_program     = new PublicKey(programId),
    auth_key = (await PublicKey.findProgramAddress(
        [
            Buffer.from('amoebit_minter'),
            minter_program.toBuffer(),
            Buffer.from('amoebit_minter'),
        ],
        minter_program
    ))[0];
    // accounts
    let account_0 = {pubkey: indexPubkey,       isSigner: false, isWritable: true},
    account_9     = {pubkey: auth_key,          isSigner: false, isWritable: true};

    // const testAmount = "4000";
    console.log(Buffer.from(testAmount));
    

    let instruction = new TransactionInstruction({
        keys: [account_0, account_9],
        programId,
        data: Buffer.from(testAmount),
    });


    let transaction = new Transaction().add(
        instruction,
    );


    let a = await sendAndConfirmTransaction(
        connection,
        transaction,
        [payer]
      ,{ skipPreflight: true }
    );

    console.log(indexPubkey.toBase58());
    console.log(a);
}

/**
 * confirm index count
 */
export async function readIndexAccount(): Promise<void> {
    const accountInfo = await connection.getAccountInfo(indexPubkey);
    if (accountInfo === null) {
        throw 'Error: index account not created';
    }

    const account_data = borsh.deserialize(
        AmoebitIndexSchema,
        AmoebitIndexAccount,
        accountInfo.data,
    );
    
    console.log(
        'there have been',
        accountInfo.data.readInt32LE(),
        'mints',
    );
}
