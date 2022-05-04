/**
 * Hello world
 */

import {
    establishConnection,
    establishPayer,
    checkAccounts,
    testContract,
    readIndexAccount,
    readTotalTokenAccount,
} from './amoebit_init';

async function main() {
    // Establish connection to the cluster
    await establishConnection();

    // our dev wallet
    await establishPayer();

    // init the index account
    await checkAccounts();

    // run the contract
    await testContract();

    // Find out how many times the contract has ran successfully
    await readIndexAccount();
    
    //
    await readTotalTokenAccount();

    console.log('Success');
}

main().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(-1);
  },
);
