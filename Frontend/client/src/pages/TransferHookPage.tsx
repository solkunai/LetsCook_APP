import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { 
  Settings, 
  Shield, 
  Zap, 
  DollarSign, 
  Users, 
  Lock,
  Unlock,
  Plus,
  Trash2,
  Edit,
  Eye,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

interface TransferHook {
  id: string;
  name: string;
  description: string;
  type: 'fee' | 'restriction' | 'custom';
  status: 'active' | 'inactive' | 'pending';
  config: {
    feeRate?: number;
    feeRecipient?: string;
    maxTransferAmount?: number;
    whitelist?: string[];
    blacklist?: string[];
    customProgram?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const mockTransferHooks: TransferHook[] = [
  {
    id: 'hook_1',
    name: 'Trading Fee Hook',
    description: 'Applies 1% trading fee on all transfers',
    type: 'fee',
    status: 'active',
    config: {
      feeRate: 1.0,
      feeRecipient: 'FeeVault123...',
    },
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20'),
  },
  {
    id: 'hook_2',
    name: 'Whitelist Hook',
    description: 'Restricts transfers to whitelisted addresses only',
    type: 'restriction',
    status: 'active',
    config: {
      whitelist: ['Address1...', 'Address2...', 'Address3...'],
    },
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-18'),
  },
  {
    id: 'hook_3',
    name: 'Max Transfer Hook',
    description: 'Limits maximum transfer amount to 1000 tokens',
    type: 'restriction',
    status: 'inactive',
    config: {
      maxTransferAmount: 1000,
    },
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-12'),
  },
];

const hookTypeColors = {
  fee: 'bg-green-100 text-green-800',
  restriction: 'bg-blue-100 text-blue-800',
  custom: 'bg-purple-100 text-purple-800',
};

const statusColors = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  pending: 'bg-yellow-100 text-yellow-800',
};

export default function TransferHookPage() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [hooks, setHooks] = useState<TransferHook[]>(mockTransferHooks);
  const [isCreatingHook, setIsCreatingHook] = useState(false);
  const [editingHook, setEditingHook] = useState<TransferHook | null>(null);

  const handleCreateHook = (hookData: Partial<TransferHook>) => {
    const newHook: TransferHook = {
      id: `hook_${Date.now()}`,
      name: hookData.name || '',
      description: hookData.description || '',
      type: hookData.type || 'fee',
      status: 'pending',
      config: hookData.config || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setHooks(prev => [...prev, newHook]);
    setIsCreatingHook(false);
  };

  const handleUpdateHook = (hookId: string, updates: Partial<TransferHook>) => {
    setHooks(prev => prev.map(hook => 
      hook.id === hookId 
        ? { ...hook, ...updates, updatedAt: new Date() }
        : hook
    ));
    setEditingHook(null);
  };

  const handleDeleteHook = (hookId: string) => {
    setHooks(prev => prev.filter(hook => hook.id !== hookId));
  };

  const handleToggleHook = (hookId: string) => {
    setHooks(prev => prev.map(hook => 
      hook.id === hookId 
        ? { 
            ...hook, 
            status: hook.status === 'active' ? 'inactive' : 'active',
            updatedAt: new Date()
          }
        : hook
    ));
  };

  const activeHooks = hooks.filter(hook => hook.status === 'active');
  const totalFeeRate = activeHooks
    .filter(hook => hook.type === 'fee')
    .reduce((sum, hook) => sum + (hook.config.feeRate || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Transfer Hooks
          </h1>
          <p className="text-gray-600 text-lg">
            Manage custom transfer logic and token restrictions
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Total Hooks</p>
                  <p className="text-2xl font-bold">{hooks.length}</p>
                </div>
                <Settings className="w-8 h-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500 to-emerald-500 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Active Hooks</p>
                  <p className="text-2xl font-bold">{activeHooks.length}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Total Fee Rate</p>
                  <p className="text-2xl font-bold">{totalFeeRate.toFixed(2)}%</p>
                </div>
                <DollarSign className="w-8 h-8 text-purple-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-red-500 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm">Restrictions</p>
                  <p className="text-2xl font-bold">
                    {hooks.filter(h => h.type === 'restriction' && h.status === 'active').length}
                  </p>
                </div>
                <Shield className="w-8 h-8 text-orange-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="mb-8">
          <TabsList className="grid w-full grid-cols-4 bg-white shadow-lg">
            <TabsTrigger 
              value="overview"
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white"
            >
              <Eye className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="hooks"
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white"
            >
              <Settings className="w-4 h-4" />
              Manage Hooks
            </TabsTrigger>
            <TabsTrigger 
              value="create"
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white"
            >
              <Plus className="w-4 h-4" />
              Create Hook
            </TabsTrigger>
            <TabsTrigger 
              value="analytics"
              className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white"
            >
              <Zap className="w-4 h-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="space-y-6">
              {hooks.map((hook) => (
                <Card key={hook.id} className="hover:shadow-lg transition-all duration-300">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          hook.status === 'active' 
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white' 
                            : 'bg-gray-100 text-gray-400'
                        }`}>
                          <Settings className="w-5 h-5" />
                        </div>
                        <div>
                          <CardTitle className="text-xl">{hook.name}</CardTitle>
                          <CardDescription>{hook.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={hookTypeColors[hook.type]}>
                          {hook.type}
                        </Badge>
                        <Badge className={statusColors[hook.status]}>
                          {hook.status}
                        </Badge>
                        <Switch
                          checked={hook.status === 'active'}
                          onCheckedChange={() => handleToggleHook(hook.id)}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Created</p>
                        <p className="font-medium">{hook.createdAt.toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Last Updated</p>
                        <p className="font-medium">{hook.updatedAt.toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Configuration</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {hook.config.feeRate && (
                            <Badge variant="outline" className="text-xs">
                              Fee: {hook.config.feeRate}%
                            </Badge>
                          )}
                          {hook.config.maxTransferAmount && (
                            <Badge variant="outline" className="text-xs">
                              Max: {hook.config.maxTransferAmount}
                            </Badge>
                          )}
                          {hook.config.whitelist && (
                            <Badge variant="outline" className="text-xs">
                              Whitelist: {hook.config.whitelist.length}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="hooks" className="mt-6">
            <div className="space-y-6">
              {hooks.map((hook) => (
                <Card key={hook.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {hook.name}
                          <Badge className={statusColors[hook.status]}>
                            {hook.status}
                          </Badge>
                        </CardTitle>
                        <CardDescription>{hook.description}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingHook(hook)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteHook(hook.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Configuration</Label>
                        <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                          <pre className="text-sm text-gray-600">
                            {JSON.stringify(hook.config, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="create" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Create New Transfer Hook</CardTitle>
                <CardDescription>
                  Configure custom transfer logic for your tokens
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="hook-name">Hook Name</Label>
                      <Input id="hook-name" placeholder="Enter hook name" />
                    </div>
                    <div>
                      <Label htmlFor="hook-type">Hook Type</Label>
                      <select className="w-full p-2 border rounded-md">
                        <option value="fee">Fee Hook</option>
                        <option value="restriction">Restriction Hook</option>
                        <option value="custom">Custom Hook</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="hook-description">Description</Label>
                    <Input id="hook-description" placeholder="Describe the hook functionality" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="fee-rate">Fee Rate (%)</Label>
                      <Input id="fee-rate" type="number" step="0.01" placeholder="0.00" />
                    </div>
                    <div>
                      <Label htmlFor="fee-recipient">Fee Recipient</Label>
                      <Input id="fee-recipient" placeholder="Enter wallet address" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="max-transfer">Max Transfer Amount</Label>
                      <Input id="max-transfer" type="number" placeholder="1000" />
                    </div>
                    <div>
                      <Label htmlFor="custom-program">Custom Program ID</Label>
                      <Input id="custom-program" placeholder="Enter program ID" />
                    </div>
                  </div>

                  <div className="flex justify-end gap-4">
                    <Button variant="outline">Cancel</Button>
                    <Button className="bg-gradient-to-r from-blue-500 to-purple-500">
                      Create Hook
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Hook Usage Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span>Total Transfers Processed</span>
                      <span className="font-bold">12,456</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fees Collected</span>
                      <span className="font-bold">1,234 SOL</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Restricted Transfers</span>
                      <span className="font-bold">89</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Success Rate</span>
                      <span className="font-bold text-green-600">99.3%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Fee Hook Activated</p>
                        <p className="text-xs text-gray-600">2 hours ago</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Transfer Blocked</p>
                        <p className="text-xs text-gray-600">4 hours ago</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Whitelist Updated</p>
                        <p className="text-xs text-gray-600">1 day ago</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
