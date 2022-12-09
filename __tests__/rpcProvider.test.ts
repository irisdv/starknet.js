import { Account, GetBlockResponse, RpcProvider, ec } from '../src';
import { StarknetChainId } from '../src/constants';
import { encodeShortString } from '../src/utils/shortString';
import { fromCallsToExecuteCalldata } from '../src/utils/transaction';
import {
  compiledErc20,
  compiledOpenZeppelinAccount,
  describeIfNotDevnet,
  describeIfRpc,
  getTestAccount,
  getTestProvider,
} from './fixtures';

describeIfRpc('RPCProvider', () => {
  const rpcProvider = getTestProvider() as RpcProvider;
  const account = getTestAccount(rpcProvider);
  let accountPublicKey: string;

  beforeAll(async () => {
    expect(account).toBeInstanceOf(Account);
    const accountKeyPair = ec.genKeyPair();
    accountPublicKey = ec.getStarkKey(accountKeyPair);
  });

  test('getChainId', async () => {
    const chainId = await rpcProvider.getChainId();
    expect([StarknetChainId.TESTNET2, StarknetChainId.MAINNET, StarknetChainId.TESTNET]).toContain(
      chainId
    );
  });

  test('getTransactionCount', async () => {
    const count = await rpcProvider.getTransactionCount('latest');
    expect(typeof count).toBe('number');
  });

  test('getBlockHashAndNumber', async () => {
    const blockHashAndNumber = await rpcProvider.getBlockHashAndNumber();
    expect(blockHashAndNumber).toHaveProperty('block_hash');
    expect(blockHashAndNumber).toHaveProperty('block_number');
  });

  test('getStateUpdate', async () => {
    const stateUpdate = await rpcProvider.getStateUpdate('latest');
    expect(stateUpdate).toHaveProperty('block_hash');
    expect(stateUpdate).toHaveProperty('new_root');
    expect(stateUpdate).toHaveProperty('old_root');
    expect(stateUpdate).toHaveProperty('state_diff');
  });

  xtest('getProtocolVersion - pathfinder not implement', async () => {
    await rpcProvider.getProtocolVersion();
  });

  describeIfNotDevnet('devnet not implement', () => {
    test('getPendingTransactions', async () => {
      const transactions = await rpcProvider.getPendingTransactions();
      expect(Array.isArray(transactions)).toBe(true);
    });
  });

  describe('RPC methods', () => {
    let latestBlock: GetBlockResponse;

    beforeAll(async () => {
      latestBlock = await rpcProvider.getBlock('latest');
    });

    test('getBlockWithTxHashes', async () => {
      const blockResponse = await rpcProvider.getBlockWithTxHashes(latestBlock.block_number);
      expect(blockResponse).toHaveProperty('transactions');
    });

    test('getBlockWithTxs', async () => {
      const blockResponse = await rpcProvider.getBlockWithTxs(latestBlock.block_number);
      expect(blockResponse).toHaveProperty('transactions');
    });

    test('getTransactionByBlockIdAndIndex', async () => {
      const transaction = await rpcProvider.getTransactionByBlockIdAndIndex(
        latestBlock.block_number,
        0
      );
      expect(transaction).toHaveProperty('transaction_hash');
    });

    xtest('traceBlockTransactions', async () => {
      await rpcProvider.traceBlockTransactions(latestBlock.block_hash);
    });

    describe('deploy contract related tests', () => {
      let contract_address;
      let transaction_hash;
      let erc20ContractAddress: string;

      beforeAll(async () => {
        const { deploy } = await account.declareDeploy({
          contract: compiledOpenZeppelinAccount,
          classHash: '0x03fcbf77b28c96f4f2fb5bd2d176ab083a12a5e123adeb0de955d7ee228c9854',
          constructorCalldata: [accountPublicKey],
          salt: accountPublicKey,
        });

        contract_address = deploy.contract_address;
        transaction_hash = deploy.transaction_hash;

        const { deploy: deployErc20 } = await account.declareDeploy({
          contract: compiledErc20,
          classHash: '0x54328a1075b8820eb43caf0caa233923148c983742402dcfc38541dd843d01a',
          constructorCalldata: [
            encodeShortString('Token'),
            encodeShortString('ERC20'),
            contract_address,
          ],
        });
        erc20ContractAddress = deployErc20.contract_address;
      });

      test('declareDeploy()', () => {
        expect(contract_address).toBeTruthy();
        expect(transaction_hash).toBeTruthy();
      });

      test('getTransactionByHash', async () => {
        const transaction = await rpcProvider.getTransactionByHash(transaction_hash);
        expect(transaction).toHaveProperty('transaction_hash');
      });

      test('getClassHashAt', async () => {
        const classHash = await rpcProvider.getClassHashAt(contract_address);
        expect(typeof classHash).toBe('string');
      });

      xtest('traceTransaction', async () => {
        await rpcProvider.traceTransaction(transaction_hash);
      });

      test('getEstimateFee', async () => {
        const call = {
          contractAddress: erc20ContractAddress,
          entrypoint: 'transfer',
          calldata: [erc20ContractAddress, '10', '0'],
        };
        const calldata = fromCallsToExecuteCalldata([call]);

        const estimate = await rpcProvider.getEstimateFee(
          {
            contractAddress: contract_address,
            calldata,
          },
          { nonce: 0 }
        );

        expect(estimate).toHaveProperty('overall_fee');
        expect(estimate).toHaveProperty('gas_consumed');
        expect(estimate).toHaveProperty('gas_price');
      });
    });

    test('getClass classHash 0x03fcbf77b28c96f4f2fb5bd2d176ab083a12a5e123adeb0de955d7ee228c9854', async () => {
      const contractClass = await rpcProvider.getClass(
        '0x03fcbf77b28c96f4f2fb5bd2d176ab083a12a5e123adeb0de955d7ee228c9854'
      );
      expect(contractClass).toHaveProperty('program');
      expect(contractClass).toHaveProperty('entry_points_by_type');
    });

    // describe('estimate and invoke related tests', () => {
    //   let erc20ContractAddress: string;

    //   beforeAll(async () => {
    //     const { deploy } = await account.declareDeploy({
    //       contract: compiledErc20,
    //       classHash: '0x54328a1075b8820eb43caf0caa233923148c983742402dcfc38541dd843d01a',
    //       constructorCalldata: [
    //         encodeShortString('Token'),
    //         encodeShortString('ERC20'),
    //         account.address,
    //       ],
    //     });
    //     erc20ContractAddress = deploy.contract_address;
    //   });

    // });

    test.todo('getEstimateFee');

    test.todo('invokeFunction');
  });
});
