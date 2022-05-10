use crate::instruction::{AmoebitIndex, BuyAmountIndex, CountInstruction, TimeStruct};
use std::convert::TryInto;
use {
    borsh::{BorshDeserialize, BorshSerialize},
    solana_program::{
        account_info::{next_account_info, AccountInfo},
        entrypoint::ProgramResult,
        msg, program,
        program_error::ProgramError,
        pubkey::Pubkey,
        system_instruction,
        sysvar::{clock::Clock, Sysvar},
    },
};

// use chrono;

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

    match instruction {
        CountInstruction::Buy(BuyAmountIndex { amount, amount_sol }) => {
            return count_amount_player(program_id, accounts, amount_sol, amount, instruction_data);
        }
        CountInstruction::Time(TimeStruct { timeRelease }) => {
            return set_time_release(program_id, accounts, timeRelease, instruction_data);
        }
        CountInstruction::Create(AmoebitIndex { amount }) => {
            return init_account_total(program_id, accounts, amount, instruction_data);
        }
        CountInstruction::Claim(AmoebitIndex { amount }) => {
            return claim_token_amount(program_id, accounts, amount, instruction_data);
        }
    }

    Ok(())
}

fn count_amount_player(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    amount: u64,
    amount_sol: u64,
    instruction_data: &[u8],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();

    let index_account = next_account_info(accounts_iter)?; // 0
    let total_token_account = next_account_info(accounts_iter)?; // 2
    let auth_wallet = next_account_info(accounts_iter)?; // 2
    let payer_wallet = next_account_info(accounts_iter)?; // 3
    let time_account = next_account_info(accounts_iter)?; // 4
    let sys_account = next_account_info(accounts_iter)?;

    if index_account.owner != program_id {
        msg!("index_account isn't owned by program");
        return Err(ProgramError::IncorrectProgramId);
    }

    if total_token_account.owner != program_id {
        msg!("total_token_account isn't owned by program");
        return Err(ProgramError::IncorrectProgramId);
    }

    if time_account.owner != program_id {
        msg!("time_account isn't owned by program");
        return Err(ProgramError::IncorrectProgramId);
    }

    if !payer_wallet.is_signer {
        msg!("payer_wallet should be signer");
        return Err(ProgramError::IncorrectProgramId);
    }

    let mut series_index = AmoebitIndex::try_from_slice(&index_account.data.borrow())?;
    let mut time_set = TimeStruct::try_from_slice(&time_account.data.borrow())?;
    let mut total_token = AmoebitIndex::try_from_slice(&total_token_account.data.borrow())?;

    // println!("{:?}", chrono::offset::Local::now());
    // println!("{:?}", chrono::offset::Utc::now());
    // let timeBlock: u64  = chrono::Utc::now().timestamp() as u64;
    let clock = Clock::get()?;

    if time_set.timeRelease > 0
        && time_set.timeRelease < clock.unix_timestamp as u64
        && amount < total_token.amount
    {
        return panic!("Time is end or not enough total_token");
    }

    program::invoke(
        &system_instruction::transfer(&payer_wallet.key, &auth_wallet.key, amount_sol),
        &[
            payer_wallet.clone(),
            auth_wallet.clone(),
            sys_account.clone(),
        ],
    )?;

    series_index.amount += amount;
    total_token.amount -= amount;

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

    if total_token_account.owner != program_id {
        msg!("total_token_account isn't owned by program");
        return Err(ProgramError::IncorrectProgramId);
    }

    if !payer_wallet.is_signer {
        msg!("payer_wallet should be signer");
        return Err(ProgramError::IncorrectProgramId);
    }

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

    if time_account.owner != program_id {
        msg!("time_account isn't owned by program");
        return Err(ProgramError::IncorrectProgramId);
    }

    if !payer_wallet.is_signer {
        msg!("payer_wallet should be signer");
        return Err(ProgramError::IncorrectProgramId);
    }

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
    
    let time_account = next_account_info(accounts_iter)?; // 3
    

    let source_token_account = next_account_info(accounts_iter)?;
    // 2. Token account to send to
    let destination_token_account = next_account_info(accounts_iter)?;
    // 3. Our wallet address
    let source_token_account_holder = next_account_info(accounts_iter)?;
    // 4. Token Program
    let token_program = next_account_info(accounts_iter)?;  
    
    
    if index_account.owner != program_id {
        msg!("index_account isn't owned by program");
        return Err(ProgramError::IncorrectProgramId);
    }
    
    if !payer_wallet.is_signer {
        msg!("payer_wallet should be signer");
        return Err(ProgramError::IncorrectProgramId);
    }
    
    let mut series_index = AmoebitIndex::try_from_slice(&index_account.data.borrow())?;
    let mut time_set = TimeStruct::try_from_slice(&time_account.data.borrow())?;

    msg!(
        "Transferring {} tokens from {} to {}",
        series_index.amount,
        source_token_account.key.to_string(),
        destination_token_account.key.to_string()
    );

    let clock = Clock::get()?;

    if time_set.timeRelease > 0 && time_set.timeRelease > clock.unix_timestamp as u64 {
        msg!("Time is end or not enough total_token");
        return Err(ProgramError::UnsupportedSysvar);
    }

    let transfer_tokens_instruction = spl_token::instruction::transfer(
        &token_program.key,
        &source_token_account.key,
        &destination_token_account.key,
        &source_token_account_holder.key,
        &[&source_token_account_holder.key],
        series_index.amount,
    )?;

    let required_accounts_for_transfer = [
        source_token_account.clone(),
        destination_token_account.clone(),
        source_token_account_holder.clone(),
    ];

    // Passing the TransactionInstruction to send
    program::invoke(
        &transfer_tokens_instruction,
        &required_accounts_for_transfer,
    )?;

    

    series_index.amount = amount;
    series_index.serialize(&mut &mut index_account.data.borrow_mut()[..])?;
    Ok(())
}
