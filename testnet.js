const fs = require('fs');
const ethers = require('ethers');

const state = JSON.parse(fs.readFileSync('./state.json'));
const url = 'https://mainnet.infura.io/v3/c51edd543c374967a6493f77518f5344';

const contractAddress = '0x5c204b44900B666801528be90AFd132CB544733c';

const abi = [
  'event Deposit(address contract, uint256 value, uint type, uint256 vaultId)',
  'function getVaultIdCounter() external view returns(uint256)',
];

const provider = new ethers.providers.JsonRpcProvider(url);
const contract = new ethers.Contract(contractAddress, abi, provider);

const filterTo = contract.filters.Deposit();

contract
  .queryFilter(filterTo, state.lastBlock > 0 ? state.lastBlock + 1 : 0)
  .then((filterRes) =>
    contract.getVaultIdCounter().then((counterRes) =>
      Promise.resolve({
        filterRes,
        counterRes,
      })
    )
  )
  .then(({filterRes, counterRes}) => {
    let highestBlock = state.lastBlock;
    const newState = filterRes.reduce((acc, entry) => {
      if (entry.blockNumber > acc.lastBlock) {
        highestBlock = entry.blockNumber;
      }
      const contractAddress = entry.args['contract'];
      if (entry.args['type'].toNumber() == 0) {
        // erc20
        if (!acc.erc20[contractAddress]) {
          acc.erc20[contractAddress] = ethers.BigNumber.from('0');
        } else {
          acc.erc20[contractAddress] = ethers.BigNumber.from(
            acc.erc20[contractAddress]
          );
        }
        acc.erc20[contractAddress] = acc.erc20[contractAddress].add(
          entry.args['value']
        );
        acc.erc20[contractAddress] = acc.erc20[contractAddress].toString();
      } else {
        // erc721
        if (!acc.erc721[contractAddress]) {
          acc.erc721[contractAddress] = 0;
        }
        acc.erc721[contractAddress] += 1;
      }
      return acc;
    }, state);
    newState.lastBlock = highestBlock;
    newState.vaultCount = counterRes.toNumber();
    fs.writeFileSync('./state.json', JSON.stringify(newState, null, 2));
  });
