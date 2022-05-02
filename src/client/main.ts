/**
 * Hello world
 */

import {
    establishConnection,
    establishPayer,
    checkAccounts,
    testContract,
    readIndexAccount,
} from './dragon';

async function main() {
    // Establish connection to the cluster
    await establishConnection();

    // our dev wallet
    await establishPayer();

    // init the index account
    await checkAccounts();

    // run the contract
    await testContract('40000');

    // Find out how many times the contract has ran successfully
    await readIndexAccount();

    console.log('Success');
}

main().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(-1);
  },
);
