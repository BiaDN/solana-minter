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
import * as BufferLayout from '@solana/buffer-layout';
import { Buffer } from 'buffer';
import { getPayer, getRpcUrl, createKeypairFromFile, uint64, Numberu64 } from './utils';

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

let time_key: PublicKey;


let indexAccount,
    timeAccount,
    totalAccount

let totalTokenPubkey: PublicKey;

let totalTokenAccount;

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
    amount = 0;
    constructor(fields: { amount: number } | undefined = undefined) {
        if (fields) {
            this.amount = fields.amount;
        }
    }
}

const AmoebitIndexSchema = new Map([
    [AmoebitIndexAccount, { kind: 'struct', fields: [['amount', 'u64']] }],
]);

const INDEX_SIZE = borsh.serialize(
    AmoebitIndexSchema,
    new AmoebitIndexAccount(),
).length;

class TimeAccount {
    timeRelease = 0;
    constructor(fields: { timeRelease: number } | undefined = undefined) {
        if (fields) {
            this.timeRelease = fields.timeRelease;
        }
    }
}

const TimeAccountSchema = new Map([
    [TimeAccount, { kind: 'struct', fields: [['timeRelease', 'u64']] }],
]);

const TIME_SIZE = borsh.serialize(
    TimeAccountSchema,
    new TimeAccount(),
).length;

// const INDEX_SIZE_ADMIN = borsh.serialize(
//     AmoebitIndexSchema,
//     new AmoebitIndexAccount(),
// ).length

export async function establishConnection(): Promise<void> {
    const rpcUrl = await getRpcUrl();
    connection = new Connection(rpcUrl, 'confirmed');
    const version = await connection.getVersion();
    console.log('Connection to cluster established:', rpcUrl, version);
    // console.log(Buffer.from(16518),'buffer')
}

export async function establishPayer(): Promise<void> {
    let fees = 0;
    if (!payer) {
        const { feeCalculator } = await connection.getRecentBlockhash();

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
    const INDEX_SEED = 'seedIndex21';
    const INDEX_SEED_TIME = 'seedTime21';
    const INDEX_SEED_ADMIN = 'seedAdmin21';

    indexPubkey = await PublicKey.createWithSeed(
        payer.publicKey,
        INDEX_SEED,
        programId,
    );

    time_key = await PublicKey.createWithSeed(
        payer.publicKey,
        INDEX_SEED_TIME,
        programId,
    );

    totalTokenPubkey = await PublicKey.createWithSeed(
        payer.publicKey,
        INDEX_SEED_ADMIN,
        programId,
    );

    // Check if the account has already been created
    indexAccount = await connection.getAccountInfo(indexPubkey);

    timeAccount = await connection.getAccountInfo(time_key);

    totalAccount = await connection.getAccountInfo(totalTokenPubkey);


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
        console.log('sent1')
    }

    if (timeAccount === null) {
        console.log(
            'Creating account',
            time_key.toBase58(),
            'to save time',
        );
        const lamports = await connection.getMinimumBalanceForRentExemption(
            TIME_SIZE,
        );


        const transaction = new Transaction().add(
            SystemProgram.createAccountWithSeed({
                basePubkey: payer.publicKey,
                fromPubkey: payer.publicKey,
                lamports,
                newAccountPubkey: time_key,
                programId: programId,
                seed: INDEX_SEED_TIME,
                space: TIME_SIZE,
            }),
        );
        await sendAndConfirmTransaction(connection, transaction, [payer]);
        console.log('sent2')

    }

    if (totalAccount === null) {
        console.log(
            'Creating account',
            totalTokenPubkey.toBase58(),
            'to count total',
        );
        const lamports = await connection.getMinimumBalanceForRentExemption(
            TIME_SIZE,
        );


        const transaction = new Transaction().add(
            SystemProgram.createAccountWithSeed({
                basePubkey: payer.publicKey,
                fromPubkey: payer.publicKey,
                lamports,
                newAccountPubkey: totalTokenPubkey,
                programId: programId,
                seed: INDEX_SEED_ADMIN,
                space: TIME_SIZE,
            }),
        );
        await sendAndConfirmTransaction(connection, transaction, [payer]);
        console.log('sent3')

    }

}

export function firstIntruction(): Buffer {
    const datalayout = BufferLayout.struct([
        BufferLayout.u8('instruction'),
        uint64('amount')
    ]);
    const data = Buffer.alloc(datalayout.span);
    console.log({ data, datalayout });
    datalayout.encode(
        {
            instruction: 0,
            amount: new Numberu64(4000).toBuffer()
        },
        data
    );
    console.log('data Layout first', data);
    console.log(data.toString(), 'string');
    return data;
}

export function secondIntruction(timeRelease: number): Buffer {
    const datalayout = BufferLayout
        .struct([
            BufferLayout.u8('instruction'),
            uint64('timeRelease')
        ])
    const data = Buffer.alloc(datalayout.span);
    datalayout.encode(
        {
            instruction: 1,
            timeRelease: new Numberu64(timeRelease).toBuffer()
        },
        data
    );
    console.log('data Layout Second', data);
    console.log(data.toString(), 'string');
    return data;
}

export function thirstIntruction(): Buffer {
    const datalayout = BufferLayout.struct([BufferLayout.u8('instruction')])
    const data = Buffer.alloc(datalayout.span);
    datalayout.encode(
        {
            instruction: 2,
        },
        data
    );
    console.log('data Layout Thirst', data);
    console.log(data.toString(), 'string');
    return data;
}

export async function created(): Promise<void> {
    // await checkAccounts();
    let account_0 = { pubkey: indexPubkey, isSigner: false, isWritable: true },
        account_9 = { pubkey: new PublicKey('A4LRKkEnPAK9dxrJgN7wetXmyGPKiWgprjF9Gq8aJboV'), isSigner: false, isWritable: true },
        account_10 = { pubkey: totalTokenPubkey, isSigner: false, isWritable: true },
        account_11 = { pubkey: payer.publicKey, isSigner: false, isWritable: true },
        account_12 = { pubkey: time_key, isSigner: false, isWritable: true };



    let instruction = new TransactionInstruction({
        keys: [account_0, account_10, account_9, account_11, account_12],
        programId,
        data: thirstIntruction(),
    });
    console.log(firstIntruction())
    console.log('359')

    let transaction = new Transaction().add(
        instruction,
    );
    console.log('364')
    let a = await sendAndConfirmTransaction(
        connection,
        transaction,
        [payer]
        , { skipPreflight: true }
    );

    console.log(a, 'send sucessful transaction');
}


export async function testContract(): Promise<void> {

    // accounts
    let account_0 = { pubkey: indexPubkey, isSigner: false, isWritable: true },
        account_10 = { pubkey: totalTokenPubkey, isSigner: false, isWritable: true },
        account_9 = { pubkey: new PublicKey('A4LRKkEnPAK9dxrJgN7wetXmyGPKiWgprjF9Gq8aJboV'), isSigner: false, isWritable: true },
        account_11 = { pubkey: payer.publicKey, isSigner: false, isWritable: true },
        account_12 = { pubkey: time_key, isSigner: false, isWritable: true };



    let instruction = new TransactionInstruction({
        keys: [account_0, account_10, account_9, account_11, account_12],
        programId,
        data: firstIntruction(),
    });
    console.log(firstIntruction())
    console.log('359')

    let transaction = new Transaction().add(
        instruction,
    );
    console.log('364')
    let a = await sendAndConfirmTransaction(
        connection,
        transaction,
        [payer]
        , { skipPreflight: true }
    );

    console.log(indexPubkey.toBase58(), time_key.toBase58(), totalTokenPubkey.toBase58());
    console.log(a, 'send sucessful transaction');
}

export async function testContract2(timeRelease: number): Promise<void> {

    // accounts
    let account_0 = { pubkey: indexPubkey, isSigner: false, isWritable: true },
        account_10 = { pubkey: totalTokenPubkey, isSigner: false, isWritable: true },
        account_9 = { pubkey: new PublicKey('A4LRKkEnPAK9dxrJgN7wetXmyGPKiWgprjF9Gq8aJboV'), isSigner: false, isWritable: true },
        account_11 = { pubkey: payer.publicKey, isSigner: false, isWritable: true },
        account_12 = { pubkey: time_key, isSigner: false, isWritable: true };



    let instruction = new TransactionInstruction({
        keys: [account_0, account_10, account_9, account_11, account_12],
        programId,
        data: secondIntruction(timeRelease),
    });
    console.log('392')


    let transaction = new Transaction().add(
        instruction,
    );
    console.log('398')

    let a = await sendAndConfirmTransaction(
        connection,
        transaction,
        [payer]
        , { skipPreflight: true }
    );

    console.log(indexPubkey.toBase58(), time_key.toBase58(), totalTokenPubkey.toBase58());
    console.log(a, 'send sucessful transaction');
}

// export async function 

export async function getTimeRelease(): Promise<void> {
    const accountInfoTime = await connection.getAccountInfo(time_key);
    if (accountInfoTime === null) {
        throw 'Error: index account not created';
    }

    const account_data = borsh.deserialize(
        TimeAccountSchema,
        TimeAccount,
        accountInfoTime.data,
    );

    console.log(
        'timeRelease',
        parseInt(account_data.timeRelease.toString(), 10),
        'time',
    );

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
        parseInt(account_data.amount.toString(), 10),
        'mints user',
    );
}

export async function readTotalTokenAccount(): Promise<void> {
    const accountInfo = await connection.getAccountInfo(totalTokenPubkey);
    if (accountInfo === null) {
        throw 'Error: index account not created';
    }

    console.log(accountInfo.data);
    const account_data = borsh.deserialize(
        AmoebitIndexSchema,
        AmoebitIndexAccount,
        accountInfo.data,
    );

    console.log(
        'there have been',
        parseInt(account_data.amount.toString(), 10),
        'mints',
    );
}
