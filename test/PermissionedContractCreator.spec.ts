import { time, loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { BytesLike, zeroPadBytes, randomBytes } from 'ethers'

const generateSalt = (): BytesLike => zeroPadBytes(randomBytes(32), 32)

describe('Lock', function () {
  async function deployContractsFixture() {
    // admins and creators
    const [owner, creator1, creator2] = await ethers.getSigners()
    const admins: HardhatEthersSigner[] = [owner]
    const creators: HardhatEthersSigner[] = [creator1, creator2]
    // deploy
    const Creator = await ethers.getContractFactory('PermissionedContractCreator')
    const creator = await Creator.deploy([owner.address], [creator1.address, creator2.address])
    // roles
    const adminRole = await creator.DEFAULT_ADMIN_ROLE()
    const createRole = await creator.CONTRACT_CREATOR_ROLE()
    return { creator, admins, creators, adminRole, createRole }
  }

  describe('Deployment', function () {
    it('Should set the right admins and creators', async function () {
      const { creator, admins, creators, adminRole, createRole } = await loadFixture(deployContractsFixture)

      admins.forEach(async (admin) => {
        expect(await creator.hasRole(adminRole, admin)).to.be.true
      })
      creators.forEach(async (creator) => {
        expect(await creator.hasRole(createRole, creator)).to.be.true
      })
    })
  })

  describe('create', function () {
    it('Should succeed to create new contract', async function () {
      const { creator, creators } = await loadFixture(deployContractsFixture)
      const Counter = await ethers.getContractFactory('Counter')
      const initialCount = 42
      const deplyTx = await Counter.getDeployTransaction(initialCount)
      const salt = generateSalt()

      const expectedAddress = await creator.getDeploymentAddress(salt, deplyTx.data)
      await expect(creator.connect(creators[0]).create(0, salt, deplyTx.data, expectedAddress))
        .to.emit(creator, 'ContractCreated')
        .withArgs(creators[0].address, 0, salt, deplyTx.data, expectedAddress)

      const counter = await ethers.getContractAt('Counter', expectedAddress)
      expect(await counter.get()).to.equal(initialCount)
    })

    // it("Should revert with the right error if called from another account", async function () {
    //   const { lock, unlockTime, otherAccount } = await loadFixture(
    //     deployContractsFixture
    //   );

    //   // We can increase the time in Hardhat Network
    //   await time.increaseTo(unlockTime);

    //   // We use lock.connect() to send a transaction from another account
    //   await expect(lock.connect(otherAccount).withdraw()).to.be.revertedWith(
    //     "You aren't the owner"
    //   );
    // });

    // it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async function () {
    //   const { lock, unlockTime } = await loadFixture(
    //     deployContractsFixture
    //   );

    //   // Transactions are sent using the first signer by default
    //   await time.increaseTo(unlockTime);

    //   await expect(lock.withdraw()).not.to.be.reverted;
    // });
  })

  //   describe("Events", function () {
  //     it("Should emit an event on withdrawals", async function () {
  //       const { lock, unlockTime, lockedAmount } = await loadFixture(
  //         deployContractsFixture
  //       );

  //       await time.increaseTo(unlockTime);

  //       await expect(lock.withdraw())
  //         .to.emit(lock, "Withdrawal")
  //         .withArgs(lockedAmount, anyValue); // We accept any value as `when` arg
  //     });
  //   });

  //   describe("Transfers", function () {
  //     it("Should transfer the funds to the owner", async function () {
  //       const { lock, unlockTime, lockedAmount, owner } = await loadFixture(
  //         deployContractsFixture
  //       );

  //       await time.increaseTo(unlockTime);

  //       await expect(lock.withdraw()).to.changeEtherBalances(
  //         [owner, lock],
  //         [lockedAmount, -lockedAmount]
  //       );
  //     });
  //   });
  // });
})
