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
import assert from 'assert'

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

const SEED_USER = 'userSeed8'
const SEED_TOTAL = 'totalSeed8'
const SEED_TIME = 'timeSeed8'
// const SEED_USER = 'userSeed'


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

class BuyAmountIndex {
    amount = 0;
    amount_sol = 0;

    constructor(fields: { amount: number, amount_sol: number } | undefined = undefined) {
        if (fields) {
            this.amount = fields.amount;
            this.amount_sol = fields.amount_sol;
        }
    }
}

const BuyAmountIndexSchema = new Map([
    [BuyAmountIndex, { kind: 'struct', fields: [['amount', 'u64'],['amount_sol', 'u64']] }],
]);

const BUY_SIZE = borsh.serialize(
    BuyAmountIndexSchema,
    new BuyAmountIndex(),
).length;

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

const initializeTotalAccountInstruction = (amount: number): Buffer => {
    const datalayout = BufferLayout.struct([
        BufferLayout.u8('instruction'),
        uint64('amount')
    ])
    const data = Buffer.alloc(datalayout.span);
    datalayout.encode(
        {
            instruction: 2,
            amount: new Numberu64(amount).toBuffer()
        },
        data
    );
    console.log('data initializeTotalAccountInstruction', data);
    console.log(data.toString(), 'string');
    return data;
}

const setTimeReleaseInstruction = (timeRelease: number): Buffer => {
    const datalayout = BufferLayout.struct([
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
    console.log('data setTimeReleaseInstruction', data);
    console.log(data.toString(), 'string');
    return data;
}

const playerBuyTokenAmountInstruction = (amountSol: number,amount: number): Buffer => {
    const datalayout = BufferLayout.struct([
        BufferLayout.u8('instruction'),
        uint64('amount'),
        uint64('amount_sol')
    ])
    const data = Buffer.alloc(datalayout.span);
    datalayout.encode(
        {
            instruction: 0,
            amount: new Numberu64(amountSol).toBuffer(),
            amount_sol: new Numberu64(amount).toBuffer()
        },
        data
    );
    console.log('data playerBuyTokenAmountInstruction', data);
    console.log(data.toString(), 'string');
    return data;
}

const playerClaimInstruction = (amount: number): Buffer => {
    const datalayout = BufferLayout.struct([
        BufferLayout.u8('instruction'),
        uint64('amount')
    ])
    const data = Buffer.alloc(datalayout.span);
    datalayout.encode(
        {
            instruction: 3,
            amount: new Numberu64(amount).toBuffer()
        },
        data
    );
    console.log('data playerClaimInstruction', data);
    console.log(data.toString(), 'string');
    return data;
}

export async function initializeTotalAccount(amount: number): Promise<void> {
    const programKeypair = await createKeypairFromFile(PROGRAM_KEYPAIR_PATH);
    programId = programKeypair.publicKey;

    totalTokenPubkey = await PublicKey.createWithSeed(
        payer.publicKey,
        SEED_TOTAL,
        programId,
    );
    totalAccount = await connection.getAccountInfo(totalTokenPubkey);

    let account_0 = { pubkey: totalTokenPubkey, isSigner: false, isWritable: true },
        account_1 = { pubkey: new PublicKey('A4LRKkEnPAK9dxrJgN7wetXmyGPKiWgprjF9Gq8aJboV'), isSigner: false, isWritable: true },
        account_2 = { pubkey: payer.publicKey, isSigner: false, isWritable: true };



    let instruction = new TransactionInstruction({
        keys: [account_0, account_1, account_2],
        programId,
        data: initializeTotalAccountInstruction(amount),
    });
    console.log('init instruction 244');

    if (totalAccount === null) {
        console.log(
            'Creating account',
            totalTokenPubkey.toBase58(),
            'to save total current',
        );
        const lamports = await connection.getMinimumBalanceForRentExemption(
            INDEX_SIZE,
        );
        console.log('init instruction 255');


        const transaction = new Transaction().add(
            SystemProgram.createAccountWithSeed({
                basePubkey: payer.publicKey,
                fromPubkey: payer.publicKey,
                lamports,
                newAccountPubkey: totalTokenPubkey,
                programId: programId,
                seed: SEED_TOTAL,
                space: INDEX_SIZE,
            }),
            instruction
        );
        await sendAndConfirmTransaction(connection, transaction, [payer]);
        console.log('sent total init')

    }
}

export async function setTimeRelease(timeRelease: number): Promise<void> {
    time_key = await PublicKey.createWithSeed(
        payer.publicKey,
        SEED_TIME,
        programId,
    );
    timeAccount = await connection.getAccountInfo(time_key);

    let account_0 = { pubkey: time_key, isSigner: false, isWritable: true },
        account_1 = { pubkey: payer.publicKey, isSigner: false, isWritable: true };


    let instruction = new TransactionInstruction({
        keys: [account_0, account_1],
        programId,
        data: setTimeReleaseInstruction(timeRelease),
    });

    if (timeAccount === null) {
        console.log(
            'Creating account',
            time_key.toBase58(),
            'to save save time',
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
                seed: SEED_TIME,
                space: TIME_SIZE,
            }),
            instruction
        );
        await sendAndConfirmTransaction(connection, transaction, [payer]);
        console.log('send set time')
    }
}


export async function playerBuyTokenAmount(amountSol: number,amount: number): Promise<void> {
    assert(amount <= 1000000,'Amount to buy must be less than 1000000');
    indexPubkey = await PublicKey.createWithSeed(
        payer.publicKey,
        SEED_USER,
        programId,
    );
    indexAccount = await connection.getAccountInfo(indexPubkey);

    let sys_key = new PublicKey('11111111111111111111111111111111')

    let account_0 = { pubkey: indexPubkey, isSigner: false, isWritable: true },
        account_1 = { pubkey: totalTokenPubkey, isSigner: false, isWritable: true },
        account_2 = { pubkey: new PublicKey('A4LRKkEnPAK9dxrJgN7wetXmyGPKiWgprjF9Gq8aJboV'), isSigner: false, isWritable: true },
        account_3 = { pubkey: payer.publicKey, isSigner: false, isWritable: true },
        account_4 = { pubkey: time_key, isSigner: false, isWritable: true },
        account_5 = { pubkey: sys_key, isSigner: false, isWritable: false };



    let instruction = new TransactionInstruction({
        keys: [account_0, account_1, account_2, account_3, account_4,account_5],
        programId,
        data: playerBuyTokenAmountInstruction(amountSol * 1000000000,amount*1000000000),
    });

    if (indexAccount === null) {
        console.log(
            'Creating account',
            indexPubkey.toBase58(),
            'to buy token',
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
                seed: SEED_USER,
                space: INDEX_SIZE,
            }),
            instruction
        );
        const result = await sendAndConfirmTransaction(connection, transaction, [payer]);
        console.log('send player buy',result)
    } else {

        const transaction = new Transaction().add(
            instruction
        );

        const result = await sendAndConfirmTransaction(connection, transaction, [payer]);
        console.log('send player buy',result)

    }

    // const lamports = await connection.getMinimumBalanceForRentExemption(
    //     INDEX_SIZE,
    // );

}

export async function claimForPlayer(amount: number): Promise<void> {

    let account_0 = { pubkey: indexPubkey, isSigner: false, isWritable: true },
        account_1 = { pubkey: payer.publicKey, isSigner: false, isWritable: true };


    let instruction = new TransactionInstruction({
        keys: [account_0, account_1],
        programId,
        data: playerClaimInstruction(amount*1000000000),
    });

    const transaction = new Transaction().add(instruction);

    await sendAndConfirmTransaction(connection, transaction, [payer]);
    console.log('send player claimed')

}

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