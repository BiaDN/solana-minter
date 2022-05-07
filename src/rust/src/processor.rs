// use solana_sdk::commitment_config::CommitmentConfig;
// use solana_client::rpc_client::RpcClient;

use crate::instruction::{AmoebitIndex, CountInstruction, TimeStruct};
use std::convert::TryInto;
use {
    borsh::{BorshDeserialize, BorshSerialize},
    solana_program::{
        account_info::{next_account_info, AccountInfo},
        entrypoint::ProgramResult,
        pubkey::Pubkey,
        sysvar::{clock::Clock, Sysvar},
    },
};

use std::str;

// const PREFIX: &str = "amoebit_minter";
// const PREFIX_TIME: &str = "time_realease";

const OUR_WALLET: &str = "69sRgm3962udozhENnTtTQUJMEHBtDQbKLUte1g9H4Hx";

pub const LAMPORTS_PER_SOL: u64 = 1_000_000_000;

#[warn(unused_must_use)]

pub fn process_instruction<'a>(
    program_id: &'a Pubkey,
    accounts: &'a [AccountInfo<'a>],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = CountInstruction::unpack(instruction_data)?;

    // let accounts_iter = &mut accounts.iter();

    // let index_account = next_account_info(accounts_iter)?; // 0
    // let total_token_account = next_account_info(accounts_iter)?; // 2
    // let auth_wallet = next_account_info(accounts_iter)?; // 2
    // let payer_wallet = next_account_info(accounts_iter)?; // 3
    // let time_account = next_account_info(accounts_iter)?; // 4

    // let mut series_index = AmoebitIndex::try_from_slice(&index_account.data.borrow())?;

    // let mut total_token = AmoebitIndex::try_from_slice(&total_token_account.data.borrow())?;
    // let mut time_set = TimeStruct::try_from_slice(&time_account.data.borrow())?;

    // let rpc_url = String::from("https://api.devnet.solana.com");

    //     let connection = RpcClient::new_with_commitment(rpc_url, CommitmentConfig::confirmed());

    // let timeRelease = time_set.de
    // pub fn transfer_sol(&from,&to,lamports_to_send) -> ProgramResult{
    //     system_instruction::transfer(from, to, lamports_to_send);
    //     Ok(());
    // }

    match instruction {
        CountInstruction::Index(AmoebitIndex { amount }) => {
            return count_amount_player(program_id, accounts, amount, instruction_data);
            // if payer_wallet.key.to_string() == OUR_WALLET && total_token.amount == 0 {
            //     total_token.amount = 10000000000000000;
            //     total_token.serialize(&mut &mut total_token_account.data.borrow_mut()[..])?;

            //     return Ok(());
            // }

            // if total_token.amount < amount {
            //     return Err(MintError::TokenFailed.into());
            // }

            // // if auth_wallet.key

            // msg!("{}", series_index.amount);

            // msg!("{}", time_set.timeRelease);

            // series_index.amount += amount;
            // total_token.amount -= amount;

            // // invoke(
            // //     &system_instruction::transfer(
            // //         payer_wallet.key,
            // //         auth_wallet.key,
            // //         1 * LAMPORTS_PER_SOL / 1000,
            // //     ),
            // //     &[payer_wallet.clone(), auth_wallet.clone()],
            // // )?;

            // // let _tx = system_instruction::transfer(
            // //     payer_wallet.key,
            // //     auth_wallet.key,
            // //     1 * LAMPORTS_PER_SOL / 10,
            // // );

            // **payer_wallet.try_borrow_mut_lamports()? -= 1 * LAMPORTS_PER_SOL / 10;
            // **auth_wallet.try_borrow_mut_lamports()? += 1 * LAMPORTS_PER_SOL / 10;

            // // let recent_blockhash = connection.get_latest_blockhash().expect("Failed to get latest blockhash.");

            // series_index.serialize(&mut &mut index_account.data.borrow_mut()[..])?;
            // total_token.serialize(&mut &mut total_token_account.data.borrow_mut()[..])?;
            // return Ok(());
        }
        CountInstruction::Time(TimeStruct { timeRelease }) => {
            return set_time_release(program_id, accounts, timeRelease, instruction_data);
            // time_set.timeRelease = timeRelease;
            // time_set.serialize(&mut &mut time_account.data.borrow_mut()[..])?;
            // return Ok(());
        }
        CountInstruction::Create(AmoebitIndex { amount }) => {
            return init_account_total(program_id, accounts, amount, instruction_data);
            // if total_token.amount
            // total_token.amount = 10000000000000000;
            // total_token.serialize(&mut &mut total_token_account.data.borrow_mut()[..])?;

            // return Ok(());
        }
        CountInstruction::Claim(AmoebitIndex { amount }) => {
            return claim_token_amount(program_id, accounts, amount, instruction_data);
            // series_index.amount -= amount;
            // series_index.serialize(&mut &mut index_account.data.borrow_mut()[..])?;
        }
    }

    Ok(())
}

fn count_amount_player(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
    instruction_data: &[u8],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();

    let index_account = next_account_info(accounts_iter)?; // 0
    let total_token_account = next_account_info(accounts_iter)?; // 2
    let auth_wallet = next_account_info(accounts_iter)?; // 2
    let payer_wallet = next_account_info(accounts_iter)?; // 3
    let time_account = next_account_info(accounts_iter)?; // 4

    let mut series_index = AmoebitIndex::try_from_slice(&index_account.data.borrow())?;
    let mut time_set = TimeStruct::try_from_slice(&time_account.data.borrow())?;
    let mut total_token = AmoebitIndex::try_from_slice(&total_token_account.data.borrow())?;

    if time_set.timeRelease > 0
        && time_set.timeRelease < Clock::get().unwrap().unix_timestamp.try_into().unwrap()
        && amount < total_token.amount
    {
        return panic!("Time is end or not enough total_token");
    }
    series_index.amount += amount;
    total_token.amount -= amount;

    **payer_wallet.try_borrow_mut_lamports()? -= 1 / 10;
    **auth_wallet.try_borrow_mut_lamports()? += 1 / 10;

    // let recent_blockhash = connection.get_latest_blockhash().expect("Failed to get latest blockhash.");

    series_index.serialize(&mut &mut index_account.data.borrow_mut()[..])?;
    total_token.serialize(&mut &mut total_token_account.data.borrow_mut()[..])?;
    Ok(())
}

fn init_account_total(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
    instruction_data: &[u8],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();

    // let index_account = next_account_info(accounts_iter)?; // 0
    let total_token_account = next_account_info(accounts_iter)?; // 2
    let auth_wallet = next_account_info(accounts_iter)?; // 2
    let payer_wallet = next_account_info(accounts_iter)?; // 3

    let mut total_token = AmoebitIndex::try_from_slice(&total_token_account.data.borrow())?;
    if payer_wallet.key.to_string() == OUR_WALLET && total_token.amount == 0 {
        total_token.amount = amount;
        total_token.serialize(&mut &mut total_token_account.data.borrow_mut()[..])?;
    }

    Ok(())
}

fn set_time_release(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    timeRelease: u64,
    instruction_data: &[u8],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let time_account = next_account_info(accounts_iter)?; // 4
    let payer_wallet = next_account_info(accounts_iter)?; // 3

    let mut time_set = TimeStruct::try_from_slice(&time_account.data.borrow())?;

    time_set.timeRelease = timeRelease;
    time_set.serialize(&mut &mut time_account.data.borrow_mut()[..])?;

    Ok(())
}

fn claim_token_amount(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
    instruction_data: &[u8],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();

    let index_account = next_account_info(accounts_iter)?; // 0
    let payer_wallet = next_account_info(accounts_iter)?; // 3

    let mut series_index = AmoebitIndex::try_from_slice(&index_account.data.borrow())?;

    series_index.amount -= amount;
    series_index.serialize(&mut &mut index_account.data.borrow_mut()[..])?;
    Ok(())
}
