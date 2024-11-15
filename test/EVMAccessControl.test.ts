import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import exp from 'constants'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const leftPadAddressToBytes32 = (address: string) => {
  const cleanAddress = address.toLowerCase().replace(/^0x/, '')
  const paddedAddress = '0'.repeat(64 - cleanAddress.length) + cleanAddress
  return '0x' + paddedAddress
}

describe('EVMAccessControl', function () {
  async function deployContractsFixture() {
    // admins and managers
    const [admin, manager1, manager2, newAdmin, newManager, creator, caller, signer1, signer2, signer3, attacker] =
      await ethers.getSigners()
    const admins: HardhatEthersSigner[] = [admin]
    const managers: HardhatEthersSigner[] = [manager1, manager2]
    const addresses: string[] = [signer1.address, signer2.address, signer3.address]
    // deploy
    const Controller = await ethers.getContractFactory('ExtendEVMAccessControl')
    const controller = await Controller.deploy([admin.address], [manager1.address, manager2.address])
    // roles
    const adminRole = await controller.DEFAULT_ADMIN_ROLE()
    const managerRole = await controller.MANAGER_ROLE()
    return {
      controller,
      admins,
      managers,
      newAdmin,
      newManager,
      creator,
      caller,
      addresses,
      attacker,
      adminRole,
      managerRole,
    }
  }

  describe('Deployment', function () {
    it('Should set the right admins and managers and prev and version', async function () {
      const { controller, admins, managers, adminRole, managerRole } = await loadFixture(deployContractsFixture)

      for (const admin of admins) {
        expect(await controller.hasRole(adminRole, admin)).to.be.true
      }
      for (const _creator of managers) {
        expect(await controller.hasRole(managerRole, _creator)).to.be.true
      }
      expect(await controller.version()).to.equal('0.0.1')
    })
  })

  describe('addCreateAllowedList/removeCreateAllowedList', function () {
    it('succeed', async function () {
      const { controller, managers, creator } = await loadFixture(deployContractsFixture)

      // Add creator to allowed list
      let receipt = await controller.connect(managers[0]).addCreateAllowedList(creator.address)
      await expect(receipt).to.emit(controller, 'CreateAllowed').withArgs(creator.address)

      expect(await controller.isAllowedToCreate(creator.address)).to.be.true
      const storageKey = await controller.computeMapStorageKey(leftPadAddressToBytes32(creator.address), 1)
      expect(Number(await controller.accessMapValue(storageKey))).to.equal(1)

      // Remove creator from allowed list
      receipt = await controller.connect(managers[0]).removeCreateAllowedList(creator.address)
      await expect(receipt).to.emit(controller, 'CreateDenied').withArgs(creator.address)

      expect(await controller.isAllowedToCreate(creator.address)).to.be.false
      expect(Number(await controller.accessMapValue(storageKey))).to.equal(0)
    })

    it('revert by ungranted caller', async function () {
      const { controller, creator, attacker, managerRole } = await loadFixture(deployContractsFixture)

      // try to add creator to allowed list
      await expect(controller.connect(attacker).addCreateAllowedList(creator.address)).to.be.revertedWith(
        `AccessControl: account ${attacker.address.toLowerCase()} is missing role ${managerRole}`,
      )

      // try to remove creator from allowed list
      await expect(controller.connect(attacker).removeCreateAllowedList(creator.address)).to.be.revertedWith(
        `AccessControl: account ${attacker.address.toLowerCase()} is missing role ${managerRole}`,
      )
    })

    it('revert by already added', async function () {
      const { controller, managers, creator } = await loadFixture(deployContractsFixture)

      // duppliate add
      await controller.connect(managers[0]).addCreateAllowedList(creator.address)
      await expect(controller.connect(managers[0]).addCreateAllowedList(creator.address)).to.be.revertedWith(
        'EAC: already allowed',
      )

      // duppliate remove
      await controller.connect(managers[0]).removeCreateAllowedList(creator.address)
      await expect(controller.connect(managers[0]).removeCreateAllowedList(creator.address)).to.be.revertedWith(
        'EAC: not allowed',
      )
    })
  })

  describe('addCallDeniedList/removeCallDeniedList', function () {
    it('succeed', async function () {
      const { controller, managers, caller } = await loadFixture(deployContractsFixture)

      // Add caller to denied list
      let receipt = await controller.connect(managers[0]).addCallDeniedList(caller.address)
      await expect(receipt).to.emit(controller, 'CallDenied').withArgs(caller.address)

      expect(await controller.isDeniedToCall(caller.address)).to.be.true
      const storageKey = await controller.computeMapStorageKey(leftPadAddressToBytes32(caller.address), 2)
      expect(Number(await controller.accessMapValue(storageKey))).to.equal(1)

      // Remove caller from denied list
      receipt = await controller.connect(managers[0]).removeCallDeniedList(caller.address)
      await expect(receipt).to.emit(controller, 'CallAllowed').withArgs(caller.address)

      expect(await controller.isDeniedToCall(caller.address)).to.be.false
      expect(Number(await controller.accessMapValue(storageKey))).to.equal(0)
    })

    it('revert by ungranted caller', async function () {
      const { controller, caller, attacker, managerRole } = await loadFixture(deployContractsFixture)

      // try to add caller to denied list
      await expect(controller.connect(attacker).addCallDeniedList(caller.address)).to.be.revertedWith(
        `AccessControl: account ${attacker.address.toLowerCase()} is missing role ${managerRole}`,
      )

      // try to remove caller from denied list
      await expect(controller.connect(attacker).removeCallDeniedList(caller.address)).to.be.revertedWith(
        `AccessControl: account ${attacker.address.toLowerCase()} is missing role ${managerRole}`,
      )
    })

    it('revert by already added', async function () {
      const { controller, managers, caller } = await loadFixture(deployContractsFixture)

      // duppliate add
      await controller.connect(managers[0]).addCallDeniedList(caller.address)
      await expect(controller.connect(managers[0]).addCallDeniedList(caller.address)).to.be.revertedWith(
        'EAC: already denied',
      )

      // duppliate remove
      await controller.connect(managers[0]).removeCallDeniedList(caller.address)
      await expect(controller.connect(managers[0]).removeCallDeniedList(caller.address)).to.be.revertedWith(
        'EAC: not denied',
      )
    })
  })

  describe('listCreateAllowed/listCallDenied', function () {
    it('succeed', async function () {
      const { controller, managers, addresses } = await loadFixture(deployContractsFixture)

      // Add two addresses to allowed list
      await controller.connect(managers[0]).addCreateAllowedList(addresses[0])
      await controller.connect(managers[0]).addCreateAllowedList(addresses[1])
      await controller.connect(managers[0]).addCallDeniedList(addresses[0])
      await controller.connect(managers[0]).addCallDeniedList(addresses[1])
      expect(await controller.listCreateAllowed()).to.deep.equal(addresses.slice(0, 2))
      expect(await controller.listCallDenied()).to.deep.equal(addresses.slice(0, 2))

      // Add last address to allowed list
      await controller.connect(managers[0]).addCreateAllowedList(addresses[2])
      await controller.connect(managers[0]).addCallDeniedList(addresses[2])
      expect(await controller.listCreateAllowed()).to.deep.equal(addresses)
      expect(await controller.listCallDenied()).to.deep.equal(addresses)

      // Remove the middle address from allowed list
      await controller.connect(managers[0]).removeCreateAllowedList(addresses[1])
      await controller.connect(managers[0]).removeCallDeniedList(addresses[1])
      expect(await controller.listCreateAllowed()).to.deep.equal([addresses[0], addresses[2], ZERO_ADDRESS])
      expect(await controller.listCallDenied()).to.deep.equal([addresses[0], addresses[2], ZERO_ADDRESS])

      // Add back the middle address to allowed list
      await controller.connect(managers[0]).addCreateAllowedList(addresses[1])
      await controller.connect(managers[0]).addCallDeniedList(addresses[1])
      expect(await controller.listCreateAllowed()).to.deep.equal(addresses)
      expect(await controller.listCallDenied()).to.deep.equal(addresses)
    })
  })

  describe('grantRole', function () {
    it('Should succeed to grant admin role', async function () {
      const { controller, admins, newAdmin, adminRole } = await loadFixture(deployContractsFixture)

      await expect(controller.connect(admins[0]).grantRole(adminRole, newAdmin.address))
        .to.emit(controller, 'RoleGranted')
        .withArgs(adminRole, newAdmin.address, admins[0].address)
      expect(await controller.hasRole(adminRole, newAdmin.address)).to.true
    })

    it('Should succeed to grant create role', async function () {
      const { controller, admins, newManager, managerRole } = await loadFixture(deployContractsFixture)

      await expect(controller.connect(admins[0]).grantRole(managerRole, newManager.address))
        .to.emit(controller, 'RoleGranted')
        .withArgs(managerRole, newManager.address, admins[0].address)
      expect(await controller.hasRole(managerRole, newManager.address)).to.true
    })

    it('Should revert by ungranted caller', async function () {
      const { controller, newManager, managers, managerRole, adminRole } = await loadFixture(deployContractsFixture)

      await expect(controller.connect(managers[1]).grantRole(managerRole, newManager.address)).to.be.revertedWith(
        `AccessControl: account ${managers[1].address.toLowerCase()} is missing role ${adminRole}`,
      )
    })
  })

  describe('revokeRole', function () {
    it('Should succeed to revoke admin role', async function () {
      const { controller, admins, adminRole } = await loadFixture(deployContractsFixture)

      await expect(controller.connect(admins[0]).revokeRole(adminRole, admins[0].address))
        .to.emit(controller, 'RoleRevoked')
        .withArgs(adminRole, admins[0].address, admins[0].address)
      expect(await controller.hasRole(adminRole, admins[0].address)).to.false
    })

    it('Should succeed to revoke controller role', async function () {
      const { controller, managers, admins, managerRole } = await loadFixture(deployContractsFixture)

      await expect(controller.connect(admins[0]).revokeRole(managerRole, managers[1].address))
        .to.emit(controller, 'RoleRevoked')
        .withArgs(managerRole, managers[1].address, admins[0].address)
      expect(await controller.hasRole(managerRole, managers[1].address)).to.false
    })

    it('Should revert by ungranted caller', async function () {
      const { controller, managers, managerRole, adminRole } = await loadFixture(deployContractsFixture)

      await expect(controller.connect(managers[1]).revokeRole(managerRole, managers[0].address)).to.be.revertedWith(
        `AccessControl: account ${managers[1].address.toLowerCase()} is missing role ${adminRole}`,
      )
    })
  })
})
