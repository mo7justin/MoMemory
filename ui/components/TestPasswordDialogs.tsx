'use client';

import { ForgotPasswordDialog } from '@/components/ForgotPasswordDialog';
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog';
import { Button } from '@/components/ui/button';

export function TestPasswordDialogs() {
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">测试密码管理功能</h2>
      
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">忘记密码功能</h3>
        <ForgotPasswordDialog />
      </div>
      
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">修改密码功能</h3>
        <ChangePasswordDialog 
          trigger={
            <Button variant="outline">
              打开修改密码对话框
            </Button>
          }
        />
      </div>
    </div>
  );
}